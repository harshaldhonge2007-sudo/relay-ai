import { MOCK_DB } from "./mockDb";
import type { RelayRole } from "../api";

export function handleMockApi(path: string, options: RequestInit = {}, role: RelayRole = "successor"): Response {
  // Normalize path: strip /api prefix and query parameters
  const cleanPath = path.replace(/^\/?api/, "").split("?")[0];
  const method = (options.method || "GET").toUpperCase();

  const jsonResponse = (data: any, status = 200) => {
    return new Response(JSON.stringify(data), {
      status,
      headers: { "Content-Type": "application/json" },
    });
  };

  // Auth endpoint
  if (cleanPath === "/auth/demo-login" || cleanPath === "auth/demo-login") {
    let userRole = role;
    if (options.body) {
      try {
        const parsed = typeof options.body === "string" ? JSON.parse(options.body) : options.body;
        if (parsed.user === "lead") userRole = "engineering_lead";
        else if (parsed.user === "successor") userRole = "successor";
        else if (parsed.user === "contractor") userRole = "contractor";
      } catch {}
    }
    return jsonResponse({
      token: "demo-standalone-token-" + Date.now(),
      role: userRole,
      display_name:
        userRole === "engineering_lead"
          ? "Alex Chen (Engineering Lead)"
          : userRole === "contractor"
          ? "Sam Rodriguez (Contractor)"
          : "Alex Chen (Successor)",
      note: "demo authentication — offline standalone fallback",
    });
  }

  // Cases endpoint
  if (cleanPath === "/cases" || cleanPath === "cases") {
    if (method === "POST") {
      try {
        const parsed = typeof options.body === "string" ? JSON.parse(options.body) : {};
        return jsonResponse({
          ...MOCK_DB.cases[0],
          id: "case-" + Math.floor(Math.random() * 900 + 100),
          name: parsed.name || "New Handover Case",
          repo_url: parsed.repo_url || "https://github.com/shopledger/api",
        });
      } catch {
        return jsonResponse(MOCK_DB.cases[0]);
      }
    }
    return jsonResponse(MOCK_DB.cases);
  }

  if (cleanPath === "/demo/seed" || cleanPath === "demo/seed") {
    return jsonResponse({ status: "ok", case_id: "case-001" });
  }

  // People
  if (cleanPath.startsWith("/people/") || cleanPath.startsWith("people/")) {
    const parts = cleanPath.split("/").filter(Boolean);
    const pid = parts[1];
    const person = MOCK_DB.people[pid] || { id: pid, display_name: "Team Member", is_leaver: false };
    return jsonResponse(person);
  }

  // Artifact detail
  if (cleanPath.startsWith("/artifacts/") || cleanPath.startsWith("artifacts/")) {
    const parts = cleanPath.split("/").filter(Boolean);
    const artId = parts[1];
    const art = MOCK_DB.artifacts.find((a: any) => a.id === artId) || MOCK_DB.artifacts[0];
    return jsonResponse(art);
  }

  // Case sub-routes: /cases/:caseId/...
  if (cleanPath.startsWith("/cases/") || cleanPath.startsWith("cases/")) {
    const parts = cleanPath.split("/").filter(Boolean); // ['cases', caseId, ...]
    const sub = parts[2];

    if (!sub) {
      return jsonResponse(MOCK_DB.cases[0]);
    }

    if (sub === "components") {
      return jsonResponse(MOCK_DB.components);
    }

    if (sub === "knowledge") {
      const components = Object.fromEntries(MOCK_DB.components.map((c: any) => [c.id, c]));
      const scores = MOCK_DB.knowledge_scores.map((ks: any) => {
        const comp = components[ks.component_id] || {};
        const criticality = comp.criticality ?? 0.5;
        const L = ks.score <= 1.0 ? ks.score * 100 : ks.score;
        const others = MOCK_DB.knowledge_scores
          .filter((o: any) => o.component_id === ks.component_id && o.person_id !== ks.person_id)
          .map((o: any) => (o.score <= 1.0 ? o.score * 100 : o.score));
        const B = others.length && L > 0 ? Math.min(Math.max(...others) / L, 1.0) : 0;
        const D = 0.6;
        const risk = Math.round(criticality * (L / 100) * (1 - B) * (1 - 0.6 * D) * 1000) / 1000;
        return {
          ...ks,
          score: L,
          breakdown: {
            edits: ks.breakdown?.edits <= 1 ? ks.breakdown.edits * 100 : ks.breakdown?.edits,
            reviews: ks.breakdown?.reviews <= 1 ? ks.breakdown.reviews * 100 : ks.breakdown?.reviews,
            discussion: ks.breakdown?.discussion <= 1 ? ks.breakdown.discussion * 100 : ks.breakdown?.discussion,
          },
          risk,
          risk_formula: `Knowledge Concentration Risk = ${criticality.toFixed(2)} × ${(L / 100).toFixed(2)} × (1 − ${B.toFixed(2)}) × (1 − 0.6 × ${D.toFixed(2)}) = ${risk.toFixed(3)}`,
          risk_score_name: "Knowledge Concentration Risk",
        };
      });
      return jsonResponse(scores);
    }

    if (sub === "artifacts") {
      const allowedRoles =
        role === "engineering_lead"
          ? ["engineering_lead", "successor", "contractor"]
          : role === "successor"
          ? ["successor", "contractor"]
          : ["contractor"];
      const visible = MOCK_DB.artifacts.filter((a: any) => {
        const itemRoles = a.acl?.allowed_roles || ["engineering_lead", "successor", "contractor"];
        return itemRoles.some((r: string) => allowedRoles.includes(r));
      });
      const withheld = MOCK_DB.artifacts.length - visible.length;
      return jsonResponse({
        items: visible,
        withheld_count: withheld,
        withheld_notice: withheld > 0 ? `${withheld} item(s) withheld due to access restrictions` : null,
        role,
      });
    }

    if (sub === "findings") {
      return jsonResponse(MOCK_DB.findings);
    }

    if (sub === "questions") {
      if (parts[3] && parts[4] === "answer") {
        return jsonResponse({ status: "ok", question_id: parts[3] });
      }
      return jsonResponse(MOCK_DB.questions);
    }

    if (sub === "handover") {
      if (parts[3] === "versions") {
        return jsonResponse(MOCK_DB.handover_versions || []);
      }
      if (parts[3] === "diff") {
        return jsonResponse({ diff: [], stats: { added: 0, removed: 0, modified: 1 } });
      }
      if (parts[3] === "verify") {
        return jsonResponse({ status: "verified", confidence: 0.95 });
      }
      if (parts[3] === "approve" || parts[3] === "release" || parts[3] === "acknowledge") {
        return jsonResponse({ status: "ok" });
      }
      if (parts[4] === "approve" || parts[4] === "reject" || parts[4] === "edit") {
        return jsonResponse({ status: "ok" });
      }
      return jsonResponse(MOCK_DB.handover);
    }

    if (sub === "completeness") {
      return jsonResponse(MOCK_DB.completeness);
    }

    if (sub === "admin") {
      return jsonResponse(MOCK_DB.admin);
    }

    if (sub === "redactions") {
      return jsonResponse(MOCK_DB.admin?.redactions || []);
    }

    if (sub === "uncertainty") {
      return jsonResponse(MOCK_DB.uncertainty);
    }

    if (sub === "decisions") {
      return jsonResponse(MOCK_DB.decisions);
    }

    if (sub === "contacts") {
      return jsonResponse(MOCK_DB.contacts);
    }

    if (sub === "continuation") {
      return jsonResponse(MOCK_DB.continuation);
    }
  }

  return jsonResponse({ status: "ok" });
}
