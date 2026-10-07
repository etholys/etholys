'use client';

import { ChevronDown, ChevronRight, Leaf, Factory, Package, Radio } from 'lucide-react';
import { useState } from 'react';
import { radarLoc, radarT } from '@/lib/radar/i18n';
import { spaceKindMeta } from '@/lib/radar/space';

export type TreeUnit = {
  id: string;
  name: string;
  kind: string;
  crop: string | null;
  moisture?: number | null;
};

export type TreeSensor = {
  id: string;
  name: string;
  unitId: string | null;
  lastValue?: number | null;
};

/** BlueIoT-style tree: place → spaces → sensors. Click selects a space. */
export function RadarSpaceTree({
  locale,
  moduleId,
  propertyName,
  units,
  sensors,
  focusedId,
  onFocus,
}: {
  locale: string;
  moduleId: string | null;
  propertyName: string;
  units: TreeUnit[];
  sensors: TreeSensor[];
  focusedId: string | null;
  onFocus: (id: string) => void;
}) {
  const loc = radarLoc(locale);
  const meta = spaceKindMeta(moduleId);
  const [openPlace, setOpenPlace] = useState(true);
  const [openUnits, setOpenUnits] = useState<Record<string, boolean>>({});

  const Icon =
    moduleId === 'agroindustry' ? Factory : moduleId === 'livestock' ? Package : Leaf;

  const toggleUnit = (id: string) => {
    setOpenUnits((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  return (
    <aside className="rounded-2xl border border-white/10 bg-white/[0.03] px-2 py-3">
      <p className="mb-2 px-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
        {radarT(loc, 'Lista árvore', 'Lista árbol', 'Tree list')}
      </p>

      <button
        type="button"
        onClick={() => setOpenPlace((v) => !v)}
        className="flex w-full items-center gap-1.5 rounded-lg px-2 py-1.5 text-left text-sm font-medium text-white hover:bg-white/5"
      >
        {openPlace ? <ChevronDown className="h-3.5 w-3.5 text-white/40" /> : <ChevronRight className="h-3.5 w-3.5 text-white/40" />}
        <Icon className="h-3.5 w-3.5 text-emerald-300" />
        <span className="truncate">{propertyName}</span>
      </button>

      {openPlace && (
        <ul className="mt-0.5 space-y-0.5 border-l border-white/10 ml-3 pl-1">
          {units.length === 0 ? (
            <li className="px-2 py-2 text-xs text-white/40">
              {radarT(loc, 'Ainda sem espaços. Usa Configurar.', 'Aún sin espacios. Usá Configurar.', 'No spaces yet. Use Setup.')}
            </li>
          ) : (
            units.map((u) => {
              const kids = sensors.filter((s) => s.unitId === u.id);
              const expanded = openUnits[u.id] ?? kids.length > 0;
              const selected = focusedId === u.id;
              return (
                <li key={u.id}>
                  <div className="flex items-center gap-0.5">
                    {kids.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => toggleUnit(u.id)}
                        className="rounded p-0.5 text-white/35 hover:text-white/70"
                        aria-label={expanded ? 'Collapse' : 'Expand'}
                      >
                        {expanded ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
                      </button>
                    ) : (
                      <span className="w-4" />
                    )}
                    <button
                      type="button"
                      onClick={() => onFocus(u.id)}
                      className={`min-w-0 flex-1 truncate rounded-lg px-2 py-1.5 text-left text-sm ${
                        selected
                          ? 'bg-emerald-500/25 font-medium text-emerald-50'
                          : 'text-white/75 hover:bg-white/5'
                      }`}
                    >
                      {u.name}
                      {u.crop ? <span className="text-white/35"> · {u.crop}</span> : null}
                    </button>
                  </div>
                  {expanded && kids.length > 0 && (
                    <ul className="ml-5 mt-0.5 space-y-0.5 border-l border-white/8 pl-1">
                      {kids.map((s) => (
                        <li key={s.id}>
                          <button
                            type="button"
                            onClick={() => onFocus(u.id)}
                            className="flex w-full items-center gap-1.5 truncate rounded-lg px-2 py-1 text-left text-xs text-white/55 hover:bg-white/5 hover:text-white/80"
                          >
                            <Radio className="h-3 w-3 shrink-0 text-sky-300/80" />
                            <span className="truncate">{s.name}</span>
                            {s.lastValue != null && (
                              <span className="ml-auto tabular-nums text-sky-200/90">
                                {Number.isInteger(s.lastValue) ? s.lastValue : s.lastValue.toFixed(0)}
                              </span>
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}

      <p className="mt-3 px-2 text-[10px] text-white/30">
        {meta.unitLabelPlural[loc]} · {units.length}
      </p>
    </aside>
  );
}
