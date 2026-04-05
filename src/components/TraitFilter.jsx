import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

export default function TraitFilter({ traits = {}, selected = {}, onChange }) {
  const [open, setOpen] = useState({});

  function toggle(key) {
    setOpen((p) => ({ ...p, [key]: !p[key] }));
  }

  function handleToggle(trait, value) {
    const current = selected[trait] ?? [];
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value];
    onChange?.({ ...selected, [trait]: next });
  }

  const keys = Object.keys(traits);
  if (!keys.length) return null;

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: "#9da7b3" }}>Traits</p>
      {keys.map((trait) => {
        const isOpen = open[trait] ?? false;
        const values = traits[trait] ?? [];
        const selectedVals = selected[trait] ?? [];

        return (
          <div key={trait} className="rounded-xl overflow-hidden" style={{ background: "#161d28", border: "1px solid rgba(255,255,255,0.06)" }}>
            <button
              className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold"
              style={{ color: "#e6edf3", background: "none", border: "none", cursor: "pointer" }}
              onClick={() => toggle(trait)}
            >
              <span>{trait}</span>
              <div className="flex items-center gap-2">
                {selectedVals.length > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-md" style={{ background: "rgba(34,211,238,0.12)", color: "#22d3ee" }}>
                    {selectedVals.length}
                  </span>
                )}
                {isOpen ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
              </div>
            </button>
            {isOpen && (
              <div className="px-4 pb-3 flex flex-col gap-1.5">
                {values.map(({ value, count }) => {
                  const checked = selectedVals.includes(value);
                  return (
                    <label key={value} className="flex items-center gap-2.5 cursor-pointer text-sm">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => handleToggle(trait, value)}
                        className="rounded"
                        style={{ accentColor: "#22d3ee" }}
                      />
                      <span style={{ color: "#e6edf3" }}>{value}</span>
                      <span className="ml-auto" style={{ color: "#9da7b3" }}>{count}</span>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
