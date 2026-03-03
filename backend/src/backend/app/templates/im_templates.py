from typing import Dict, List, Any

# Define the structure of the Information Memorandum
# This maps granular sub-sections to specific prompt instructions and the underlying metrics they should consume.
# FRAMEWORK: Headline -> Evidence -> Credit Impact (10/10 Professional Standard)

IM_TEMPLATE: List[Dict[str, Any]] = [
    # --- 1. EXECUTIVE SUMMARY ---
    {
        "id": "adani_overview",
        "title": "1.1 Adani Portfolio Overview",
        "prompt_instruction": "HEADLINE: Massive scale and diversified portfolio. EVIDENCE: Global presence, total assets, and sector leadership. IMPACT: Strength and stability of the group.",
        "mapped_metrics": ["Adani Group Scale", "Sponsor Portfolio", "Sponsor Market Cap"],
        "writing_framework": "Narrative"
    },
    {
        "id": "adani_structure",
        "title": "1.2 Adani Portfolio Structure",
        "prompt_instruction": "HEADLINE: Integrated organizational framework. EVIDENCE: Vertical integration and synergy across group entities. IMPACT: Cross-functional efficiency and strategic alignment.",
        "mapped_metrics": ["Corporate Structure", "Group Entities", "Sponsor Parent"],
        "writing_framework": "Narrative"
    },
    {
        "id": "competitive_strengths",
        "title": "1.3 Competitive Strengths",
        "prompt_instruction": "HEADLINE: Sustainable competitive moat. EVIDENCE: Low cost of capital, execution track record, and technical expertise. IMPACT: Long-term operational superiority.",
        "mapped_metrics": ["Sponsor Track Record", "Cost of Capital", "Key Strengths"]
    },
    {
        "id": "project_overview",
        "title": "1.4 Project Overview",
        "prompt_instruction": "HEADLINE: Strategic asset summary. EVIDENCE: Project capacity, location, and key technical parameters. IMPACT: Core revenue generator for the facility.",
        "mapped_metrics": ["Capacity", "Technology Type", "Location", "Project Purpose"]
    },
    {
        "id": "trans_overview",
        "title": "1.5 Transaction Overview",
        "prompt_instruction": "HEADLINE: Summarize the financing request. EVIDENCE: Facility amount, type, and purpose. IMPACT: How this transaction supports the borrower's strategic growth.",
        "mapped_metrics": ["Borrower", "Total Debt / Loan Amount", "Facility Type", "Project Purpose", "Total Project Cost", "Debt to Equity Ratio"]
    },
    {
        "id": "comp_overview",
        "title": "1.6 Company Overview",
        "prompt_instruction": "HEADLINE: The borrower's position in the market. EVIDENCE: Sponsor background and operational capacity. IMPACT: Reliability and experience of the borrowing entity.",
        "mapped_metrics": ["Sponsor", "Sponsor Parent", "Operational Capacity", "Business Model"],
        "writing_framework": "Narrative"
    },
    {
        "id": "proj_snapshot",
        "title": "1.7 Project Snapshot",
        "prompt_instruction": "HEADLINE: Technical core of the project. EVIDENCE: Capacity, technology, and location. IMPACT: Operational viability and technology-specific advantages.",
        "mapped_metrics": ["Capacity", "Technology Type", "Location", "Offtaker", "PPA Duration", "Tariff Rate"]
    },
    {
        "id": "inv_highlights",
        "title": "1.8 Key Investment Highlights",
        "prompt_instruction": "HEADLINE: Top credit strengths. EVIDENCE: PPA sovereign nature, sponsor track record, DSCR. IMPACT: Investment-grade quality of the deal profile.",
        "mapped_metrics": ["PPA Nature", "Sponsor Track Record", "DSCR", "Key Strengths"],
        "writing_framework": "Bulletized"
    },

    # --- 2. INDUSTRY AND MARKET OVERVIEW ---
    {
        "id": "sector_trends",
        "title": "2.1 Macro Sector Trends",
        "prompt_instruction": "HEADLINE: Sector growth trajectory. EVIDENCE: National capacity targets and market growth rates. IMPACT: Strategic alignment with government targets.",
        "mapped_metrics": ["National Capacity Target", "Sector Outlook", "Market Growth Rate"]
    },
    {
        "id": "reg_framework",
        "title": "2.2 Regulatory Framework",
        "prompt_instruction": "HEADLINE: Stability of the policy environment. EVIDENCE: RPOs, grid connectivity policies. IMPACT: Protection against regulatory reversals.",
        "mapped_metrics": ["Regulatory Framework", "Supportive Policies", "RPO Targets"]
    },
    {
        "id": "market_dynamics",
        "title": "2.3 Market Dynamics",
        "prompt_instruction": "HEADLINE: Counterparty landscape. EVIDENCE: Tariff stabilization trends and DISCOM risk mitigants. IMPACT: Predictable revenue environment.",
        "mapped_metrics": ["Tariff Trends", "Technology Advancements", "Module Type", "Counterparty Risk Mitigants"]
    },

    # --- 3. COMPANY PROFILE ---
    {
        "id": "corp_history",
        "title": "3.1 Corporate Overview and History",
        "prompt_instruction": "HEADLINE: Borrower's operational maturity. EVIDENCE: Incorporation age and portfolio performance (CUF). IMPACT: Demonstrated execution capability.",
        "mapped_metrics": ["Incorporation Date", "Operational History", "Portfolio CUF"]
    },
    {
        "id": "biz_model",
        "title": "3.2 Business Model and Segments",
        "prompt_instruction": "HEADLINE: Revenue diversification. EVIDENCE: Segment contributions (Solar, EPC, O&M). IMPACT: Stability of cash flow across different business cycles.",
        "mapped_metrics": ["Revenue Stream", "BOO Model", "Solar Generation Contribution", "EPC Contribution", "O&M Contribution"]
    },
    {
        "id": "corp_outlook",
        "title": "3.3 Recent Developments and Outlook",
        "prompt_instruction": "HEADLINE: Vision for scale. EVIDENCE: Pipeline capacity and hybrid focus. IMPACT: Sustainable growth and market share expansion.",
        "mapped_metrics": ["Capacity Targets", "Strategic Focus", "Hybrid Projects", "Energy Storage"]
    },

    # --- 4. PROJECT SPECIFICATIONS ---
    {
        "id": "site_tech",
        "title": "4.1 Site and Technical Details",
        "prompt_instruction": "HEADLINE: Technical robustness. EVIDENCE: Insolation data and Monocrystalline PERC tech. IMPACT: Generation efficiency and resource abundance.",
        "mapped_metrics": ["Location", "Solar Insolation", "Geographical Advantage", "Technology Type", "Expected Generation"]
    },
    {
        "id": "comm_struct",
        "title": "4.2 Commercial Structure",
        "prompt_instruction": "HEADLINE: Bankability of the revenue contract. EVIDENCE: PPA duration, tariff, and offtaker credit. IMPACT: Strong debt-service visibility.",
        "mapped_metrics": ["Offtaker", "PPA Capacity", "Tariff Rate", "Estimated CUF"]
    },
    {
        "id": "impl_status",
        "title": "4.3 Implementation Status",
        "prompt_instruction": "HEADLINE: De-risked execution status. EVIDENCE: Land acquisition % and EPC status. IMPACT: Minimal completion risk for the project.",
        "mapped_metrics": ["Land Acquisition", "EPC Contractor", "Expected Commercial Operations Date (COD)"]
    },

    # --- 5. FINANCIAL PERFORMANCE AND PROJECTIONS ---
    {
        "id": "hist_revenue",
        "title": "5.1.1 Historical Revenue Analysis",
        "prompt_instruction": "HEADLINE: Revenue growth trend. EVIDENCE: Historical revenue metrics and CAGR. IMPACT: Proof of the borrower's revenue-generating power.",
        "mapped_metrics": ["Revenue", "Historical Revenue"]
    },
    {
        "id": "hist_profit",
        "title": "5.1.2 Profitability & Margins (EBITDA/PAT)",
        "prompt_instruction": "HEADLINE: Operational efficiency. EVIDENCE: EBITDA margin and PAT growth. IMPACT: Robust cash surplus availability for debt servicing.",
        "mapped_metrics": ["EBITDA", "Net Profit / PAT", "EBITDA Margin", "Operating Costs"]
    },
    {
        "id": "cap_struct_leverage",
        "title": "5.2.1 Capital Structure & Leverage",
        "prompt_instruction": "HEADLINE: Healthy balance sheet positioning. EVIDENCE: Total debt and Debt/EBITDA. IMPACT: Gearing ratio and additional borrowing capacity.",
        "mapped_metrics": ["Total Debt", "Net Debt", "Debt to EBITDA", "Debt to Equity Ratio"]
    },
    {
        "id": "liquidity_coverage",
        "title": "5.2.2 Liquidity & Coverage Ratios",
        "prompt_instruction": "HEADLINE: Debt servicing comfort. EVIDENCE: DSCR and Interest Coverage ratios. IMPACT: Significant safety buffer against interest rate shocks.",
        "mapped_metrics": ["Interest Coverage Ratio", "DSCR", "Cash Flow Coverage"]
    },
    {
        "id": "proj_model_narrative",
        "title": "5.3.1 Projected Financial Trajectory",
        "prompt_instruction": "HEADLINE: Strong forecasted growth. EVIDENCE: Projected Revenue/EBITDA arrays. IMPACT: Future financial viability and ROI.",
        "mapped_metrics": ["Projected Revenue", "Projected EBITDA", "Projected Opex"],
        "special_instruction": "LLM MUST explicitly address the EBITDA reconciliation here. Flag that Annual Report historically stated one EBITDA figure, while the revised management Financial Model projects a different baseline. Add a 'Reconciliation Note'."
    },
    {
        "id": "proj_model_bottomline",
        "title": "5.3.2 Projected Net Income & Sustainability",
        "prompt_instruction": "HEADLINE: Longevity of profitability. EVIDENCE: Projected Net Income sustainability. IMPACT: Long-term dividend/equity and principal repayment capacity.",
        "mapped_metrics": ["Projected Net Income", "Projected EBITDA Margin"]
    },

    # --- 6. FINANCING STRUCTURE AND TERM SHEET ---
    {
        "id": "loan_terms",
        "title": "6.1.1 Core Loan Terms",
        "prompt_instruction": "HEADLINE: Market-standard financing. EVIDENCE: Loan tenor and repayment schedule. IMPACT: Structure that matches project cash life.",
        "mapped_metrics": ["Total Debt / Loan Amount", "Loan Tenor", "Moratorium Period", "Repayment Schedule"],
        "writing_framework": "Bulletized"
    },
    {
        "id": "pricing_fees",
        "title": "6.1.2 Pricing, Interest & Fees",
        "prompt_instruction": "HEADLINE: Competitive pricing. EVIDENCE: Benchmark linkage and upfront fees. IMPACT: Cost-effective financing that doesn't weight on IRR.",
        "mapped_metrics": ["Interest Rate", "Benchmark Rate", "Processing Fee", "Upfront Fee", "Penal Interest", "Prepayment Premium"],
        "writing_framework": "Bulletized"
    },
    {
        "id": "security_details",
        "title": "6.3.1 Security & Collateral Package",
        "prompt_instruction": "HEADLINE: Comprehensive credit protection. EVIDENCE: Primary security, Escrow, DSRA. IMPACT: Fully secured profile for the lender.",
        "mapped_metrics": ["Security Package", "Collateral Security", "Escrow / DSRA"],
        "writing_framework": "Bulletized"
    },
    {
        "id": "guarantees",
        "title": "6.3.2 Corporate & Personal Guarantees",
        "prompt_instruction": "HEADLINE: Strong guarantor backing. EVIDENCE: Corporate guarantee names and personal backing. IMPACT: Credit enhancement beyond the project asset.",
        "mapped_metrics": ["Guarantor", "Corporate Guarantee", "Personal Guarantee"],
        "writing_framework": "Bulletized"
    },
    {
        "id": "covenants_financial",
        "title": "6.4.1 Financial Covenants",
        "prompt_instruction": "HEADLINE: Strict financial monitoring. EVIDENCE: DSCR and Leverage thresholds. IMPACT: Early warning systems that prevent credit deterioration.",
        "mapped_metrics": ["Minimum DSCR Threshold", "Maximum Debt to Equity Ratio", "Maximum Total Debt to EBITDA Leverage"],
        "special_instruction": "You MUST extract and list the exact numerical thresholds for DSCR, Leverage (Debt/EBITDA), Debt/Equity, and exact Interest Rates as found in the Sanction Letter. Do not summarize them vaguely; provide the precise banking covenant figures."
    },
    {
        "id": "covenants_non_financial",
        "title": "6.4.2 Non-Financial Covenants",
        "prompt_instruction": "HEADLINE: Robust reporting requirements. EVIDENCE: Affirmative/Negative covenant lists. IMPACT: Transparency and lender control over core operations.",
        "mapped_metrics": ["Affirmative Covenants", "Negative Covenants"]
    },
    {
        "id": "cps_drawdown",
        "title": "6.5.1 Conditions Precedent to Drawdown",
        "prompt_instruction": "HEADLINE: Readiness for implementation. EVIDENCE: Equity proof, legal resolutions, and closure. IMPACT: Ensuring no procedural delays before first drawdown.",
        "mapped_metrics": ["Equity Injection", "Conditions Precedent", "Legal Opinion", "Financial Closure"],
        "writing_framework": "Bulletized"
    },

    # --- 7. RISK ANALYSIS AND MITIGANTS ---
    {
        "id": "risk_completion",
        "title": "7.1 Completion and Execution Risk",
        "prompt_instruction": "HEADLINE: Proactive engineering risk management. EVIDENCE: EPC contract type and status. IMPACT: Protection against construction delays.",
        "mapped_metrics": ["Construction Risk", "EPC Contract Type", "Land Acquisition", "Mitigants"]
    },
    {
        "id": "risk_ops",
        "title": "7.2 Operational and Resource Risk",
        "prompt_instruction": "HEADLINE: Stability of long-term generation. EVIDENCE: Resource data and O&M contracts. IMPACT: Consistently delivering projected cash flows.",
        "mapped_metrics": ["Operational Risk", "O&M Status", "Equipment Supplier", "Mitigants"]
    },
    {
        "id": "risk_revenue",
        "title": "7.3 Counterparty and Revenue Risk",
        "prompt_instruction": "HEADLINE: Secured revenue stream. EVIDENCE: Offtaker profile and sovereign support. IMPACT: Lowest-possible default profile on revenue.",
        "mapped_metrics": ["Off-take Risk", "Offtaker Credit", "Payment Security Mechanism", "Mitigants"]
    },
    {
        "id": "risk_market",
        "title": "7.4 Financial and Market Risk",
        "prompt_instruction": "HEADLINE: Hedged financial environment. EVIDENCE: Reset clauses and hedging policies. IMPACT: Resilience against macro-economic volatility.",
        "mapped_metrics": ["Interest Rate Risk", "Currency Risk", "Hedging Policy", "Mitigants"]
    },
    {
        "id": "risk_reg",
        "title": "7.5 Regulatory and Policy Risk",
        "prompt_instruction": "HEADLINE: Compliant and protected status. EVIDENCE: Regulatory framework and grandfathering. IMPACT: Legal certainty for the transaction lifespan.",
        "mapped_metrics": ["Policy Risk", "Regulatory Framework", "Grandfathering Clause", "Mitigants"]
    },

    # --- 8. CONCLUSION ---
    {
        "id": "conclusion",
        "title": "8.1 Credit Assessment Summary",
        "prompt_instruction": "HEADLINE: Strategic summary. EVIDENCE: Combination of all 7 sections. IMPACT: Final credit evaluation and viability statement.",
        "mapped_metrics": ["Overall Credit Rating", "Key Strengths", "Summary Risk", "Conclusion"]
    }
]
