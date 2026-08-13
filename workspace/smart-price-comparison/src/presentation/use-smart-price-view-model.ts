import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScannerError, type SmartPriceApplication } from "../business/ports";
import { extractProductCode } from "../business/product-pricing";
import type {
  AppView,
  AppWorkspace,
  MenuDraft,
  Persona,
  PriceBasis,
  ProductOffer,
} from "../business/types";

export type Notice = { tone: "info" | "success" | "warning"; message: string } | null;

const createId = (prefix: string): string =>
  `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const loadInitial = (services: SmartPriceApplication): { workspace: AppWorkspace; notice: Notice } => {
  try {
    return { workspace: services.facade.loadWorkspace(), notice: null };
  } catch {
    return {
      workspace: services.facade.createDefaultWorkspace(),
      notice: {
        tone: "warning",
        message: "이전 저장 데이터를 읽지 못해 안전한 샘플로 복구했습니다.",
      },
    };
  }
};

export const useSmartPriceViewModel = (services: SmartPriceApplication) => {
  const initial = useMemo(() => loadInitial(services), [services]);
  const [workspace, setWorkspace] = useState(initial.workspace);
  const [notice, setNotice] = useState<Notice>(initial.notice);
  const [isScanning, setIsScanning] = useState(false);
  const [pendingCode, setPendingCode] = useState("");
  const scanController = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      services.facade.saveWorkspace(workspace);
    } catch {
      setNotice({
        tone: "warning",
        message: "브라우저 저장 공간에 기록하지 못했습니다. 현재 화면의 입력은 유지됩니다.",
      });
    }
  }, [services, workspace]);

  useEffect(
    () => () => {
      scanController.current?.abort();
    },
    [],
  );

  const updateWorkspace = useCallback((recipe: (current: AppWorkspace) => AppWorkspace) => {
    setWorkspace((current) => recipe(current));
  }, []);

  const setPersona = (persona: Persona) =>
    updateWorkspace((current) => ({ ...current, persona }));
  const setActiveView = (activeView: AppView) =>
    updateWorkspace((current) => ({ ...current, activeView }));
  const setComparisonBasis = (comparisonBasis: PriceBasis) =>
    updateWorkspace((current) => ({ ...current, comparisonBasis }));
  const updateMenu = (patch: Partial<MenuDraft>) =>
    updateWorkspace((current) => ({
      ...current,
      menuDraft: { ...current.menuDraft, ...patch },
    }));
  const addIngredient = () =>
    updateMenu({
      ingredients: [
        ...workspace.menuDraft.ingredients,
        { id: createId("ingredient"), name: "새 원재료", cost: 0 },
      ],
    });
  const updateIngredient = (id: string, patch: { name?: string; cost?: number }) =>
    updateMenu({
      ingredients: workspace.menuDraft.ingredients.map((ingredient) =>
        ingredient.id === id ? { ...ingredient, ...patch } : ingredient,
      ),
    });
  const removeIngredient = (id: string) =>
    updateMenu({
      ingredients: workspace.menuDraft.ingredients.filter((ingredient) => ingredient.id !== id),
    });
  const addProduct = (offer: Omit<ProductOffer, "id">) => {
    updateWorkspace((current) => ({
      ...current,
      products: [...current.products, { ...offer, id: createId("product") }],
    }));
    setPendingCode("");
    setNotice({ tone: "success", message: `${offer.name}을(를) 비교 목록에 추가했습니다.` });
  };
  const removeProduct = (id: string) =>
    updateWorkspace((current) => ({
      ...current,
      products: current.products.filter((product) => product.id !== id),
    }));

  const acceptCode = useCallback(
    (rawCode: string) => {
      const code = extractProductCode(rawCode);
      if (!code) {
        setNotice({ tone: "warning", message: "상품 코드를 입력해 주세요." });
        return;
      }
      const known = services.facade.findProductByCode(code);
      const alreadyAdded = workspace.products.some((product) => product.code === code);
      setPendingCode(code);
      setActiveView("products");
      if (known && !alreadyAdded) {
        updateWorkspace((current) => ({
          ...current,
          activeView: "products",
          products: [...current.products, { ...known, id: createId("product") }],
        }));
        setPendingCode("");
        setNotice({ tone: "success", message: `${known.name} 정보를 찾아 비교 목록에 추가했습니다.` });
      } else if (known) {
        setNotice({ tone: "info", message: "이미 비교 목록에 있는 상품입니다." });
      } else {
        setNotice({
          tone: "info",
          message: "코드를 읽었습니다. 상품명·가격·용량을 입력하면 바로 비교됩니다.",
        });
      }
    },
    [updateWorkspace, workspace.products],
  );

  const startScan = useCallback(async () => {
    if (isScanning) return;
    if (!services.scanner.isSupported()) {
      setNotice({
        tone: "warning",
        message: "이 환경은 카메라 스캔을 지원하지 않습니다. 아래에 코드를 직접 입력해 주세요.",
      });
      return;
    }
    const controller = new AbortController();
    scanController.current = controller;
    setIsScanning(true);
    setNotice({ tone: "info", message: "카메라에서 상품 코드를 찾고 있습니다…" });
    try {
      const code = await services.scanner.scan(controller.signal, 15_000);
      acceptCode(code);
    } catch (error) {
      const message =
        error instanceof ScannerError && error.code === "cancelled"
          ? "스캔을 취소했습니다. 수동 입력을 계속 사용할 수 있습니다."
          : error instanceof Error
            ? `${error.message} 수동 입력을 이용해 주세요.`
            : "코드를 읽지 못했습니다. 수동 입력을 이용해 주세요.";
      setNotice({ tone: "warning", message });
    } finally {
      scanController.current = null;
      setIsScanning(false);
    }
  }, [acceptCode, isScanning, services.scanner]);

  const cancelScan = () => scanController.current?.abort();
  const resetSamples = () => {
    setWorkspace(services.facade.createDefaultWorkspace());
    setNotice({ tone: "success", message: "샘플 데이터로 다시 시작했습니다." });
  };

  return {
    workspace,
    menuResult: services.facade.calculateMenu(workspace.menuDraft),
    comparedProducts: services.facade.compareProducts(
      workspace.products,
      workspace.comparisonBasis,
    ),
    notice,
    setNotice,
    isScanning,
    pendingCode,
    setPersona,
    setActiveView,
    setComparisonBasis,
    updateMenu,
    addIngredient,
    updateIngredient,
    removeIngredient,
    addProduct,
    removeProduct,
    acceptCode,
    startScan,
    cancelScan,
    resetSamples,
  };
};
