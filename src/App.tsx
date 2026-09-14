import { useState } from "react";

import "./App.css";

import Home from "./Pages/Home";
import DataIngestion from "./Pages/DataIngestion";
import Investigation from "./Pages/Investigation";
import InvestigationWorkspace from "./Pages/InvestigationWorkspace";
import Asgs from "./Pages/Asgs";

type Page =
  | "home"
  | "ingestion"
  | "investigate"
  | "workspace"
  | "asgs";

function App() {
  const [page, setPage] =
    useState<Page>("home");

  const [
    selectedDatasetId,
    setSelectedDatasetId,
  ] = useState<number | null>(null);

  return (
    <div className="page-container">
      <div className="page-content">
        {page === "home" && (
          <Home navigate={setPage} />
        )}

        {page === "ingestion" && (
          <DataIngestion navigate={setPage} />
        )}

        {page === "investigate" && (
          <Investigation
            navigate={setPage}
            setSelectedDatasetId={
              setSelectedDatasetId
            }
          />
        )}

        {page === "workspace" &&
          selectedDatasetId !== null && (
            <InvestigationWorkspace
              datasetId={
                selectedDatasetId
              }
              navigate={setPage}
            />
          )}

        {page === "asgs" && (
          <Asgs navigate={setPage} />
        )}
      </div>
    </div>
  );
}

export default App;