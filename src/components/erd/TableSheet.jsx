import { useState } from "react";
import { Plus, Trash2, Key, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const TYPES = ["uuid", "text", "varchar(255)", "integer", "bigint", "boolean", "numeric(10,2)", "timestamptz", "date", "jsonb"];
export const KIND_LABEL = { one_to_one: "1 : 1", one_to_many: "1 : N", many_to_many: "N : M" };
export const tmpId = () => `t-${Math.random().toString(36).slice(2, 9)}`;

function FieldRow({ f, onChange, onDelete, i }) {
  const set = (k, v) => onChange({ ...f, [k]: v });
  const flag = (k, label) => (
    <button onClick={() => set(k, !f[k])} title={label} data-testid={`field-${i}-${k}-toggle`}
      className={`rounded px-1.5 py-0.5 font-mono text-[10px] transition-colors ${f[k] ? "bg-accent text-accent-foreground" : "text-muted-foreground/60 hover:bg-muted"}`}>{label}</button>
  );
  return (
    <div className="group grid grid-cols-[1fr_120px] gap-x-2 gap-y-1 py-2 border-b hairline last:border-0" data-testid={`field-row-${i}`}>
      <input className="inline-input text-sm font-mono" value={f.name} onChange={(e) => set("name", e.target.value)} data-testid={`field-${i}-name-input`} />
      <input className="inline-input text-xs font-mono text-primary" list="pg-types" value={f.type} onChange={(e) => set("type", e.target.value)} data-testid={`field-${i}-type-input`} />
      <div className="col-span-2 flex flex-wrap items-center gap-1">
        {flag("primary_key", "PK")}{flag("nullable", "NULL")}{flag("unique", "UQ")}{flag("indexed", "IDX")}
        <input className="inline-input ml-2 max-w-[160px] text-[11px] font-mono text-muted-foreground" placeholder="default" value={f.default || ""} onChange={(e) => set("default", e.target.value || null)} data-testid={`field-${i}-default-input`} />
        <button className="ml-auto opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive" onClick={onDelete} data-testid={`field-${i}-delete-btn`}><Trash2 className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

function AddRelation({ entity, entities, onAdd }) {
  const [kind, setKind] = useState("one_to_many");
  const [target, setTarget] = useState("");
  const others = entities.filter((e) => e.id !== entity.id);
  return (
    <div className="flex flex-wrap items-end gap-2 rounded-md bg-muted/40 p-3">
      <div className="text-xs text-muted-foreground w-full">Each <b>{entity.name}</b> row belongs to one…</div>
      <Select value={target} onValueChange={setTarget}><SelectTrigger className="h-8 w-40 text-xs" data-testid="rel-target-select"><SelectValue placeholder="table" /></SelectTrigger>
        <SelectContent>{others.map((o) => <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>)}</SelectContent></Select>
      <Select value={kind} onValueChange={setKind}><SelectTrigger className="h-8 w-28 text-xs" data-testid="rel-kind-select"><SelectValue /></SelectTrigger>
        <SelectContent>{Object.entries(KIND_LABEL).map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent></Select>
      <Button size="sm" className="h-8" disabled={!target} onClick={() => { onAdd(target, kind); setTarget(""); }} data-testid="rel-add-btn"><Link2 className="h-3.5 w-3.5 mr-1" />Add</Button>
    </div>
  );
}

export default function TableSheet({ entity, schema, usage, onChange, onSchema, onClose }) {
  if (!entity) return null;
  const set = (k, v) => onChange({ ...entity, [k]: v });
  const names = Object.fromEntries(schema.entities.map((e) => [e.id, e.name]));
  const fieldName = Object.fromEntries(schema.entities.flatMap((e) => e.fields.map((f) => [f.id, f.name])));
  const rels = schema.relationships.filter((r) => r.source_entity === entity.id || r.target_entity === entity.id);
  const addRel = (targetId, kind) => {
    const target = schema.entities.find((e) => e.id === targetId);
    const tpk = target.fields.find((f) => f.primary_key);
    let ents = schema.entities;
    let sf = null;
    if (kind !== "many_to_many") {
      sf = { id: tmpId(), name: `${target.name.replace(/s$/, "")}_id`, type: tpk?.type || "uuid", primary_key: false, nullable: false, unique: kind === "one_to_one", indexed: true, default: null };
      ents = ents.map((e) => (e.id === entity.id ? { ...e, fields: [...e.fields, sf] } : e));
    }
    onSchema({ entities: ents, relationships: [...schema.relationships, { id: tmpId(), source_entity: entity.id, source_field: sf?.id || null, target_entity: targetId, target_field: kind === "many_to_many" ? null : tpk?.id || null, kind, on_delete: "CASCADE" }] });
  };
  const deleteTable = () => {
    onSchema({ entities: schema.entities.filter((e) => e.id !== entity.id), relationships: schema.relationships.filter((r) => r.source_entity !== entity.id && r.target_entity !== entity.id) });
    onClose();
  };
  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-[520px] overflow-y-auto" data-testid="table-editor-panel">
        <datalist id="pg-types">{TYPES.map((t) => <option key={t} value={t} />)}</datalist>
        <SheetHeader><SheetTitle className="font-mono">{entity.name}</SheetTitle></SheetHeader>
        <div className="mt-5 space-y-5">
          <div className="space-y-1.5"><Label>Table name</Label><Input className="font-mono" value={entity.name} onChange={(e) => set("name", e.target.value)} data-testid="table-name-input" /></div>
          <div className="space-y-1.5"><Label>Purpose</Label><Textarea value={entity.purpose} onChange={(e) => set("purpose", e.target.value)} data-testid="table-purpose-input" /></div>
          <label className="flex items-center justify-between text-sm"><span>Created / updated timestamps</span><Switch checked={entity.timestamps} onCheckedChange={(v) => set("timestamps", v)} data-testid="table-timestamps-switch" /></label>
          <div>
            <div className="flex items-center justify-between mb-1"><Label>Columns</Label>
              <Button size="sm" variant="ghost" className="h-7" onClick={() => set("fields", [...entity.fields, { id: tmpId(), name: "new_column", type: "text", primary_key: false, nullable: true, unique: false, indexed: false, default: null }])} data-testid="add-field-btn"><Plus className="h-3 w-3 mr-1" />Column</Button></div>
            {entity.fields.map((f, i) => <FieldRow key={f.id} i={i} f={f} onChange={(nf) => set("fields", entity.fields.map((x) => (x.id === f.id ? nf : x)))} onDelete={() => onSchema({ entities: schema.entities.map((e) => (e.id === entity.id ? { ...e, fields: e.fields.filter((x) => x.id !== f.id) } : e)), relationships: schema.relationships.map((r) => ({ ...r, source_field: r.source_field === f.id ? null : r.source_field, target_field: r.target_field === f.id ? null : r.target_field })) })} />)}
          </div>
          <div className="space-y-2">
            <Label>Relationships</Label>
            {rels.map((r) => (
              <div key={r.id} className="flex items-center gap-2 text-xs font-mono" data-testid={`rel-row-${r.id}`}>
                <span className="flex-1">{names[r.source_entity]}{r.source_field && `.${fieldName[r.source_field] || "?"}`} → {names[r.target_entity]}{r.target_field && `.${fieldName[r.target_field] || "?"}`}</span>
                <span className="rounded bg-muted px-1.5">{KIND_LABEL[r.kind]}</span>
                <Select value={r.on_delete} onValueChange={(v) => onSchema({ ...schema, relationships: schema.relationships.map((x) => (x.id === r.id ? { ...x, on_delete: v } : x)) })}>
                  <SelectTrigger className="h-7 w-28 text-[10px]"><SelectValue /></SelectTrigger>
                  <SelectContent>{["CASCADE", "SET NULL", "RESTRICT", "NO ACTION"].map((o) => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select>
                <button onClick={() => onSchema({ ...schema, relationships: schema.relationships.filter((x) => x.id !== r.id) })}><Trash2 className="h-3.5 w-3.5 text-muted-foreground" /></button>
              </div>
            ))}
            <AddRelation entity={entity} entities={schema.entities} onAdd={addRel} />
          </div>
          <div className="space-y-1.5" data-testid="table-usage">
            <Label>Used by</Label>
            {!usage.endpoints.length && !usage.features.length && !usage.tasks.length && <p className="text-xs text-muted-foreground">Not linked to any endpoint, feature or task yet.</p>}
            {usage.features.map((f) => <div key={f} className="text-xs"><span className="text-muted-foreground mr-1">feature</span>{f}</div>)}
            {usage.endpoints.map((e) => <div key={e} className="text-xs font-mono"><span className="text-muted-foreground mr-1 font-sans">endpoint</span>{e}</div>)}
            {usage.tasks.map((t) => <div key={t} className="text-xs"><span className="text-muted-foreground mr-1">task</span>{t}</div>)}
          </div>
          <Button variant="ghost" className="w-full text-destructive" onClick={deleteTable} data-testid="delete-table-btn"><Trash2 className="h-4 w-4 mr-1.5" />Delete table</Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}

export { Key };
