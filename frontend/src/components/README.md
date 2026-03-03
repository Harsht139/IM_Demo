# Components Library - Profinance Nexus Frontend

This directory contains reusable UI components, maintaining a consistent design system throughout the application.

## Structure
- **common/**: Atomic and molecular components like `Button`, `Input`, `Card`, and `Badge`.
- **layout/**: Structural components like `Navbar`, `Sidebar`, and `Footer`.
- **Specialized Components**:
    - **Extraction/Citations**: UI for displaying document previews with interactive bounding-box highlights.
    - **Reconciliation**: Interfaces for reviewing and resolving data conflicts.
    - **IM Builder**: Rich text and preview surfaces for synthesis.

## Design Standards
- **Tailwind CSS**: All styling is utility-first, following the project's premium aesthetic (slate/grey palettes, monospaced metrics).
- **Framer Motion**: Used for micro-animations (hover effects, loading transitions).
- **Lucide React**: The standard icon library.

## Component Principles
- **Functional & Typed**: All components use TypeScript functional patterns.
- **Props-Driven**: Components should be stateless where possible, receiving data and callbacks through props.
