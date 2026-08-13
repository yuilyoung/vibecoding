import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App";
import { createApplicationServices } from "./composition-root";
import "./styles.css";

const services = createApplicationServices();

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <App services={services} />
  </StrictMode>,
);
