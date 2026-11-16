import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";
import { CaseProvider } from "./contexts/CaseContext";
import { EvidenceDrawerProvider } from "./components/EvidenceDrawer";
import Landing from "./screens/Landing";
import NotFound from "./screens/NotFound";

import Cases from "./screens/Cases";
import KnowledgeRadar from "./screens/KnowledgeRadar";
import WorkTimeline from "./screens/WorkTimeline";
import Findings from "./screens/Findings";
import Interview from "./screens/Interview";
import Handover from "./screens/Handover";
import CompletenessTest from "./screens/CompletenessTest";
import Uncertainty from "./screens/Uncertainty";
import DecisionLog from "./screens/DecisionLog";
import Admin from "./screens/Admin";
import IntelligenceDashboard from "./screens/IntelligenceDashboard";
import ProjectAssets from "./screens/ProjectAssets";
import BusFactor from "./screens/BusFactor";
import Validation from "./screens/Validation";
import CaseHome from "./screens/CaseHome";
import Limits from "./screens/Limits";
import { AppLayout } from "./components/shell/AppLayout";

/* ------------------------------------------------------------------ */
/*  App root — providers + router                                     */
/* ------------------------------------------------------------------ */

export default function App() {
  return (
    <BrowserRouter>
      <CaseProvider>
        <EvidenceDrawerProvider>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/cases" element={<Cases />} />
            <Route element={<AppLayout />}>
              <Route path="/case/:caseId" element={<CaseHome />} />
              <Route path="/case/:caseId/intelligence" element={<IntelligenceDashboard />} />
              <Route path="/case/:caseId/knowledge" element={<KnowledgeRadar />} />
              <Route path="/case/:caseId/busfactor" element={<BusFactor />} />
              <Route path="/case/:caseId/validation" element={<Validation />} />
              <Route path="/case/:caseId/timeline" element={<WorkTimeline />} />
              <Route path="/case/:caseId/findings" element={<Findings />} />
              <Route path="/case/:caseId/interview" element={<Interview />} />
              <Route path="/case/:caseId/handover" element={<Handover />} />
              <Route path="/case/:caseId/assets" element={<ProjectAssets />} />
              <Route path="/case/:caseId/completeness" element={<CompletenessTest />} />
              <Route path="/case/:caseId/uncertainty" element={<Uncertainty />} />
              <Route path="/case/:caseId/decisions" element={<DecisionLog />} />
              <Route path="/case/:caseId/admin" element={<Admin />} />
              <Route path="/case/:caseId/limits" element={<Limits />} />
            </Route>
            <Route path="/limits" element={<Limits />} />
            <Route path="/validation" element={<Validation />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </EvidenceDrawerProvider>
      </CaseProvider>
    </BrowserRouter>
  );
}
