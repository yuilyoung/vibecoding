import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import type { SmartPriceApplication } from "./business/ports";
import type { AppView, MenuDraft, Persona, PriceBasis } from "./business/types";
import { useSmartPriceViewModel } from "./presentation/use-smart-price-view-model";
import {
  ArrowIcon,
  CameraIcon,
  CartIcon,
  DashboardIcon,
  MarkIcon,
  MenuIcon,
  PlusIcon,
  ScanIcon,
  StoreIcon,
  TagIcon,
  TrashIcon,
  TrendIcon,
  UsersIcon,
} from "./presentation/icons";

const won = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});
const decimalWon = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });
const percent = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });

const money = (value: number) => won.format(value);
const pct = (value: number) => `${percent.format(value)}%`;
const numberFrom = (value: string) => Math.max(0, Number(value) || 0);

const personaLabels: Record<Persona, { label: string; caption: string; icon: ReactNode }> = {
  consumer: { label: "소비자", caption: "마트 최저가 비교", icon: <CartIcon /> },
  owner: { label: "자영업자", caption: "메뉴 수익 관리", icon: <StoreIcon /> },
  agency: { label: "대행업체", caption: "고객사 비교 운영", icon: <UsersIcon /> },
};

const viewLabels: Record<AppView, { label: string; eyebrow: string; title: string; icon: ReactNode }> = {
  dashboard: { label: "대시보드", eyebrow: "오늘의 가격 인사이트", title: "반갑습니다. 무엇을 비교할까요?", icon: <DashboardIcon /> },
  menu: { label: "메뉴 수익 계산", eyebrow: "메뉴 원가 분석", title: "팔수록 남는 가격인지 확인하세요", icon: <MenuIcon /> },
  products: { label: "상품 가격 비교", eyebrow: "QR · 바코드 비교", title: "할인보다 정확한 단위가격을 보세요", icon: <ScanIcon /> },
};

function NumberField({
  label,
  value,
  onChange,
  suffix = "원",
  hint,
  disabled = false,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  suffix?: string;
  hint?: string;
  disabled?: boolean;
}) {
  return (
    <label className="field">
      <span className="field-label">{label}</span>
      <span className="number-input">
        <input
          type="number"
          min="0"
          step="any"
          inputMode="decimal"
          disabled={disabled}
          value={value}
          onChange={(event) => onChange(numberFrom(event.target.value))}
        />
        <em>{suffix}</em>
      </span>
      {hint && <small>{hint}</small>}
    </label>
  );
}

function DashboardPage({ vm }: { vm: ReturnType<typeof useSmartPriceViewModel> }) {
  const cheapest = vm.comparedProducts.find((product) => product.isCheapest);
  const matchingCount = vm.comparedProducts.filter((product) => product.isCompatible).length;
  return (
    <div className="page-stack">
      <section className="hero-grid">
        <button className="hero-card profit-hero" onClick={() => vm.setActiveView("menu")}>
          <span className="hero-icon"><TrendIcon /></span>
          <span className="hero-copy">
            <small>대표 메뉴 예상 이익</small>
            <strong data-testid="dashboard-profit">{money(vm.menuResult.profit)}</strong>
            <em>{vm.workspace.menuDraft.name} · 이익률 {pct(vm.menuResult.profitMargin)}</em>
          </span>
          <span className="hero-arrow"><ArrowIcon /></span>
        </button>
        <button className="hero-card compare-hero" onClick={() => vm.setActiveView("products")}>
          <span className="hero-icon"><TagIcon /></span>
          <span className="hero-copy">
            <small>{vm.workspace.comparisonBasis} 최저 상품</small>
            <strong>{cheapest ? `${decimalWon.format(cheapest.normalizedPrice ?? 0)}원` : "비교 준비 중"}</strong>
            <em>{cheapest ? `${cheapest.offer.name} · ${cheapest.offer.store}` : "상품을 추가해 보세요"}</em>
          </span>
          <span className="hero-arrow"><ArrowIcon /></span>
        </button>
      </section>

      <section className="dashboard-grid">
        <article className="paper-panel snapshot-panel">
          <header className="panel-heading">
            <div><span>메뉴 손익 스냅샷</span><h2>{vm.workspace.menuDraft.name}</h2></div>
            <button className="text-button" onClick={() => vm.setActiveView("menu")}>자세히 보기 <ArrowIcon /></button>
          </header>
          <div className="snapshot-chart" aria-label={`메뉴가 중 원가율 ${pct(vm.menuResult.costRate)}`}>
            <div className="donut" style={{ "--rate": `${Math.min(100, vm.menuResult.costRate)}%` } as React.CSSProperties}>
              <span><strong>{pct(vm.menuResult.costRate)}</strong><small>원가율</small></span>
            </div>
            <dl className="cost-legend">
              <div><dt><i className="dot ingredients"/>원재료</dt><dd>{money(vm.menuResult.ingredientCost)}</dd></div>
              <div><dt><i className="dot labor"/>인건비</dt><dd>{money(vm.menuResult.laborCost)}</dd></div>
              <div><dt><i className="dot operating"/>기타비</dt><dd>{money(vm.menuResult.operatingCost)}</dd></div>
              <div className="total"><dt>총비용</dt><dd>{money(vm.menuResult.totalCost)}</dd></div>
            </dl>
          </div>
        </article>

        <article className="paper-panel quick-panel">
          <header className="panel-heading"><div><span>빠른 시작</span><h2>지금 바로 계산하기</h2></div></header>
          <button className="quick-action" onClick={() => vm.setActiveView("menu")}>
            <span className="quick-icon green"><MenuIcon /></span>
            <span><strong>메뉴 수익 계산</strong><small>원재료부터 공과금까지</small></span><ArrowIcon />
          </button>
          <button className="quick-action" onClick={() => vm.setActiveView("products")}>
            <span className="quick-icon coral"><ScanIcon /></span>
            <span><strong>상품 코드 스캔</strong><small>10g · 100g · 10ml 비교</small></span><ArrowIcon />
          </button>
        </article>
      </section>

      <section className="paper-panel recent-panel">
        <header className="panel-heading">
          <div><span>저장된 비교</span><h2>상품 가격 한눈에 보기</h2></div>
          <p>{matchingCount}개 상품이 현재 기준과 일치합니다</p>
        </header>
        <div className="compact-products">
          {vm.comparedProducts.slice(0, 3).map((product) => (
            <div className={`compact-row ${product.isCheapest ? "winner" : ""}`} key={product.offer.id}>
              <span className="product-glyph"><TagIcon /></span>
              <span className="product-identity"><strong>{product.offer.name}</strong><small>{product.offer.store} · {product.offer.quantity}{product.offer.unit}</small></span>
              <span className="product-price"><small>실구매가</small><strong>{money(product.purchasePrice)}</strong></span>
              <span className="unit-price"><small>{vm.workspace.comparisonBasis}당</small><strong>{product.normalizedPrice === null ? "단위 다름" : `${decimalWon.format(product.normalizedPrice)}원`}</strong></span>
              {product.isCheapest && <b className="winner-badge">최저가</b>}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function MenuCalculatorPage({ vm }: { vm: ReturnType<typeof useSmartPriceViewModel> }) {
  const menu = vm.workspace.menuDraft;
  const setCost = (key: keyof Pick<MenuDraft, "laborCost" | "gasCost" | "packagingCost" | "waterCost" | "electricityCost">) =>
    (value: number) => vm.updateMenu({ [key]: value });

  return (
    <div className="calculator-layout">
      <section className="paper-panel editor-panel">
        <header className="panel-heading"><div><span>판매 정보</span><h2>메뉴와 원재료</h2></div><b className="autosave">● 자동 저장</b></header>
        <div className="menu-basics">
          <label className="field"><span className="field-label">메뉴명</span><input value={menu.name} onChange={(event) => vm.updateMenu({ name: event.target.value })}/></label>
          <NumberField label="실제 메뉴가격" value={menu.salePrice} onChange={(salePrice) => vm.updateMenu({ salePrice })}/>
        </div>

        <div className="section-divider"><span>원재료비</span><strong>{money(vm.menuResult.ingredientCost)}</strong></div>
        <div className="ingredient-list">
          {menu.ingredients.map((ingredient, index) => (
            <div className="ingredient-row" key={ingredient.id}>
              <span className="row-index">{String(index + 1).padStart(2, "0")}</span>
              <label><span className="sr-only">원재료명</span><input value={ingredient.name} onChange={(event) => vm.updateIngredient(ingredient.id, { name: event.target.value })}/></label>
              <label className="number-input"><span className="sr-only">원재료 원가</span><input type="number" min="0" inputMode="numeric" value={ingredient.cost} onChange={(event) => vm.updateIngredient(ingredient.id, { cost: numberFrom(event.target.value) })}/><em>원</em></label>
              <button className="icon-button" aria-label={`${ingredient.name} 삭제`} onClick={() => vm.removeIngredient(ingredient.id)}><TrashIcon /></button>
            </div>
          ))}
          <button className="add-row" onClick={vm.addIngredient}><PlusIcon /> 원재료 추가</button>
        </div>

        <div className="section-divider"><span>인건비 · 기타비</span><small>메뉴 1개 판매분에 해당하는 비용</small></div>
        <div className="cost-fields">
          <NumberField label="인건비" value={menu.laborCost} onChange={setCost("laborCost")}/>
          <NumberField label="가스비" value={menu.gasCost} onChange={setCost("gasCost")}/>
          <NumberField label="포장비" value={menu.packagingCost} onChange={setCost("packagingCost")}/>
          <NumberField label="수도세" value={menu.waterCost} onChange={setCost("waterCost")}/>
          <NumberField label="전기세" value={menu.electricityCost} onChange={setCost("electricityCost")}/>
        </div>
      </section>

      <aside className={`result-ticket ${vm.menuResult.status}`}>
        <div className="ticket-top"><span>PROFIT CHECK</span><em>실시간 계산</em></div>
        <div className="ticket-menu"><small>{menu.name || "메뉴 이름 없음"}</small><strong>{money(menu.salePrice)}</strong><span>실제 판매가격</span></div>
        <dl className="receipt-lines">
          <div><dt>원재료비</dt><dd>{money(vm.menuResult.ingredientCost)}</dd></div>
          <div><dt>인건비</dt><dd>{money(vm.menuResult.laborCost)}</dd></div>
          <div><dt>기타비</dt><dd>{money(vm.menuResult.operatingCost)}</dd></div>
          <div className="receipt-total"><dt>총비용</dt><dd data-testid="menu-total-cost">{money(vm.menuResult.totalCost)}</dd></div>
        </dl>
        <div className="profit-block">
          <span>{vm.menuResult.status === "loss" ? "예상 손실" : vm.menuResult.status === "break-even" ? "손익분기" : "실제 예상 이익"}</span>
          <strong data-testid="menu-profit">{money(vm.menuResult.profit)}</strong>
          <p>{vm.menuResult.status === "profit" ? "메뉴 한 개를 팔 때 남는 금액입니다." : vm.menuResult.status === "loss" ? "원가가 판매가보다 높습니다. 가격이나 비용을 조정해 보세요." : "비용과 판매가가 같습니다."}</p>
        </div>
        <div className="ratio-grid"><div><small>이익률</small><strong>{pct(vm.menuResult.profitMargin)}</strong></div><div><small>원가율</small><strong>{pct(vm.menuResult.costRate)}</strong></div></div>
        <p className="ticket-note">※ 세금·배달 수수료는 포함되지 않은 예상치입니다.</p>
      </aside>
    </div>
  );
}

function ProductComparisonPage({ vm }: { vm: ReturnType<typeof useSmartPriceViewModel> }) {
  const [manualCode, setManualCode] = useState("");
  const [name, setName] = useState("");
  const [store, setStore] = useState("");
  const [listPrice, setListPrice] = useState(0);
  const [salePrice, setSalePrice] = useState(0);
  const [hasSale, setHasSale] = useState(false);
  const [quantity, setQuantity] = useState(100);
  const [unit, setUnit] = useState<"g" | "ml">("g");
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    if (vm.pendingCode) {
      setManualCode(vm.pendingCode);
      setShowForm(true);
    }
  }, [vm.pendingCode]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!name.trim() || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(listPrice) || listPrice <= 0) {
      vm.setNotice({ tone: "warning", message: "상품명, 0보다 큰 정상가와 용량을 입력해 주세요." });
      return;
    }
    if (hasSale && (!Number.isFinite(salePrice) || salePrice <= 0 || salePrice > listPrice)) {
      vm.setNotice({ tone: "warning", message: "할인가는 0원보다 크고 정상가 이하여야 합니다." });
      return;
    }
    vm.addProduct({
      code: manualCode.trim(),
      name: name.trim(),
      store: store.trim() || "매장 미입력",
      listPrice,
      salePrice: hasSale ? salePrice : null,
      quantity,
      unit,
    });
    setManualCode(""); setName(""); setStore(""); setListPrice(0); setSalePrice(0); setQuantity(100); setShowForm(false);
  };

  const basisOptions: PriceBasis[] = ["10g", "100g", "10ml"];
  return (
    <div className="page-stack">
      <section className="scanner-strip">
        <div className="scanner-art"><span className="scan-corner top-left"/><span className="scan-corner top-right"/><span className="scan-corner bottom-left"/><span className="scan-corner bottom-right"/><CameraIcon /><i/></div>
        <div className="scanner-copy"><span>CAMERA SCAN</span><h2>QR · 바코드로 빠르게 추가</h2><p>상품 코드를 읽은 뒤 할인 가격과 용량을 확인하세요. 미등록 상품도 직접 입력할 수 있습니다.</p></div>
        <button className="primary-button" onClick={vm.startScan} disabled={vm.isScanning}><ScanIcon />{vm.isScanning ? "스캔 중…" : "카메라로 스캔"}</button>
        <span className="or-divider">또는</span>
        <form className="code-entry" onSubmit={(event) => { event.preventDefault(); vm.acceptCode(manualCode); }}>
          <label><span className="sr-only">상품 코드</span><input placeholder="QR URL 또는 바코드 번호" value={manualCode} onChange={(event) => setManualCode(event.target.value)}/></label>
          <button type="submit">코드 확인</button>
        </form>
      </section>

      <section className="comparison-toolbar">
        <div><span>단위가격 기준</span><div className="basis-tabs">{basisOptions.map((basis) => <button className={vm.workspace.comparisonBasis === basis ? "active" : ""} key={basis} onClick={() => vm.setComparisonBasis(basis)}>{basis}당</button>)}</div></div>
        <button className="secondary-button" onClick={() => setShowForm((visible) => !visible)}><PlusIcon /> 상품 직접 추가</button>
      </section>

      {showForm && (
        <form className="paper-panel product-form" onSubmit={submit}>
          <header className="panel-heading"><div><span>상품 정보</span><h2>비교할 가격 직접 입력</h2></div><button type="button" className="text-button" onClick={() => setShowForm(false)}>닫기</button></header>
          <div className="product-form-grid">
            <label className="field"><span className="field-label">상품 코드</span><input placeholder="선택 입력" value={manualCode} onChange={(event) => setManualCode(event.target.value)}/></label>
            <label className="field"><span className="field-label">상품명</span><input placeholder="예: 국산 오트밀" value={name} onChange={(event) => setName(event.target.value)}/></label>
            <label className="field"><span className="field-label">매장명</span><input placeholder="예: 우리동네마트" value={store} onChange={(event) => setStore(event.target.value)}/></label>
            <NumberField label="정상가" value={listPrice} onChange={setListPrice}/>
            <label className="field checkbox-field"><span><input type="checkbox" checked={hasSale} onChange={(event) => setHasSale(event.target.checked)}/> 할인 가격 사용</span></label>
            <NumberField label="할인가" value={salePrice} onChange={setSalePrice} disabled={!hasSale}/>
            <NumberField label="포장량" value={quantity} onChange={setQuantity} suffix={unit}/>
            <label className="field"><span className="field-label">단위</span><select value={unit} onChange={(event) => setUnit(event.target.value as "g" | "ml")}><option value="g">g · 중량</option><option value="ml">ml · 용량</option></select></label>
          </div>
          <button className="primary-button form-submit" type="submit">비교 목록에 추가 <ArrowIcon /></button>
        </form>
      )}

      <section className="products-section">
        <header className="panel-heading"><div><span>가격 비교표</span><h2>{vm.comparedProducts.length}개 상품 비교 중</h2></div><p>같은 단위 상품 중 최저가를 표시합니다</p></header>
        <div className="product-card-grid">
          {vm.comparedProducts.map((product) => (
            <article className={`compare-card ${product.isCheapest ? "winner" : ""}`} key={product.offer.id} data-testid="product-card">
              {product.isCheapest && <b className="winner-ribbon">현재 최저가</b>}
              <button className="card-delete" aria-label={`${product.offer.name} 삭제`} onClick={() => vm.removeProduct(product.offer.id)}><TrashIcon /></button>
              <div className="compare-card-head"><span className="product-glyph"><TagIcon /></span><div><small>{product.offer.store}</small><h3>{product.offer.name}</h3><p>{product.offer.quantity.toLocaleString("ko-KR")}{product.offer.unit} · {product.offer.code || "코드 없음"}</p></div></div>
              <div className="purchase-price"><span>실구매가</span><strong>{money(product.purchasePrice)}</strong>{product.savings > 0 && <em>{money(product.savings)} 절약 · {pct(product.discountRate)}</em>}</div>
              <div className="normalized-price"><span>{vm.workspace.comparisonBasis}당 가격</span><strong>{product.normalizedPrice === null ? "비교 단위 다름" : `${decimalWon.format(product.normalizedPrice)}원`}</strong></div>
            </article>
          ))}
          {vm.comparedProducts.length === 0 && <div className="empty-state"><ScanIcon/><h3>비교할 상품이 없습니다</h3><p>코드를 스캔하거나 상품 정보를 직접 추가해 주세요.</p></div>}
        </div>
      </section>
    </div>
  );
}

export default function App({ services }: { services: SmartPriceApplication }) {
  const vm = useSmartPriceViewModel(services);
  const view = viewLabels[vm.workspace.activeView];
  return (
    <div className="app-shell">
      <aside className="sidebar">
        <button className="brand" onClick={() => vm.setActiveView("dashboard")} aria-label="Smart 가격비교 홈"><span><MarkIcon /></span><strong>Smart<em>가격비교</em></strong></button>
        <p className="side-label">WORKSPACE</p>
        <nav aria-label="주요 메뉴">{(Object.keys(viewLabels) as AppView[]).map((key) => <button className={vm.workspace.activeView === key ? "active" : ""} key={key} onClick={() => vm.setActiveView(key)}>{viewLabels[key].icon}<span>{viewLabels[key].label}</span></button>)}</nav>
        <div className="sidebar-tip"><MarkIcon /><strong>숫자는 솔직합니다</strong><p>할인율보다 단위가격,<br/>매출보다 실제 이익을 보세요.</p></div>
        <button className="reset-button" onClick={vm.resetSamples}>샘플 데이터로 초기화</button>
      </aside>

      <main className="main-area">
        <header className="topbar">
          <div className="mobile-brand"><span><MarkIcon /></span><strong>Smart 가격비교</strong></div>
          <div className="persona-switch" aria-label="사용자 유형">{(Object.keys(personaLabels) as Persona[]).map((persona) => <button className={vm.workspace.persona === persona ? "active" : ""} key={persona} onClick={() => vm.setPersona(persona)}>{personaLabels[persona].icon}<span><strong>{personaLabels[persona].label}</strong><small>{personaLabels[persona].caption}</small></span></button>)}</div>
        </header>
        <div className="content-wrap">
          <header className="page-heading"><div><span>{view.eyebrow}</span><h1>{view.title}</h1></div><div className="date-stamp"><small>LOCAL WORKSPACE</small><strong>{new Intl.DateTimeFormat("ko-KR", { month: "long", day: "numeric", weekday: "short" }).format(new Date())}</strong></div></header>
          {vm.notice && <div className={`notice ${vm.notice.tone}`} role="status"><MarkIcon/><span>{vm.notice.message}</span><button aria-label="알림 닫기" onClick={() => vm.setNotice(null)}>×</button></div>}
          {vm.workspace.activeView === "dashboard" && <DashboardPage vm={vm}/>}
          {vm.workspace.activeView === "menu" && <MenuCalculatorPage vm={vm}/>}
          {vm.workspace.activeView === "products" && <ProductComparisonPage vm={vm}/>}
        </div>
        <nav className="mobile-nav" aria-label="모바일 메뉴">{(Object.keys(viewLabels) as AppView[]).map((key) => <button aria-label={viewLabels[key].label} className={vm.workspace.activeView === key ? "active" : ""} key={key} onClick={() => vm.setActiveView(key)}>{viewLabels[key].icon}<span>{viewLabels[key].label.replace(" 계산", "").replace(" 가격", "")}</span></button>)}</nav>
      </main>
      {vm.isScanning && <button className="scan-cancel-floating" onClick={vm.cancelScan}>스캔 취소</button>}
    </div>
  );
}
