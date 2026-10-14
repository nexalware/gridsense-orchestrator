import FactoryView from "@/components/FactoryView";

// "/": the 3D virtual factory with its HUD. Planned pages (status table,
// priorities config, AI approvals) will be sibling routes under app/.
export default function Home() {
  return <FactoryView />;
}
