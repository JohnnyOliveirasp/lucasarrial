# -*- coding: utf-8 -*-
"""
Converte workflow ComfyUI do formato UI (export do editor / RunningHub)
para o formato API (aceito pelo /prompt e pelo runpod/worker-comfyui).

- Remove nodes cosmeticos (Note, MarkdownNote, Label, PreviewAny)
- Resolve indirecao SetNode/GetNode (links virtuais)
- Mapeia widgets_values -> nomes de input (via entradas com "widget" no export)
- Pula o widget fantasma "control_after_generate" que segue inputs de seed

Uso:
    python convert_ui_to_api.py <entrada_ui.json> <saida_api.json>
"""
import json
import sys

COSMETIC = {"Note", "MarkdownNote", "Label (rgthree)", "PreviewAny"}
SEED_NAMES = {"seed", "noise_seed"}


def build_link_map(doc):
    """link_id -> (src_node_id, src_slot)"""
    links = {}
    for l in doc.get("links", []):
        # formato: [id, src_node, src_slot, dst_node, dst_slot, type]
        links[l[0]] = (l[1], l[2])
    return links


def resolve_setget(doc, links):
    """Devolve dict: get_node_id -> (src_node_id, src_slot) do SetNode correspondente."""
    set_by_key = {}
    for n in doc["nodes"]:
        if n["type"] == "SetNode":
            key = n["widgets_values"][0]
            in_link = next((i.get("link") for i in n.get("inputs", []) if i.get("link")), None)
            if in_link is None:
                raise ValueError(f"SetNode {n['id']} ({key}) sem link de entrada")
            set_by_key[key] = links[in_link]
    get_map = {}
    for n in doc["nodes"]:
        if n["type"] == "GetNode":
            key = n["widgets_values"][0]
            if key not in set_by_key:
                raise ValueError(f"GetNode {n['id']} referencia chave inexistente: {key}")
            get_map[n["id"]] = set_by_key[key]
    return get_map


def trace_source(node_id, slot, nodes_by_id, get_map, links):
    """Segue a origem atravessando GetNode/SetNode ate um node real."""
    while True:
        node = nodes_by_id[node_id]
        if node["type"] == "GetNode":
            node_id, slot = get_map[node_id]
            continue
        return node_id, slot


def convert(doc):
    links = build_link_map(doc)
    nodes_by_id = {n["id"]: n for n in doc["nodes"]}
    get_map = resolve_setget(doc, links)
    skip_types = COSMETIC | {"SetNode", "GetNode"}

    api = {}
    for n in doc["nodes"]:
        if n["type"] in skip_types:
            continue
        inputs = {}
        raw = n.get("widgets_values") or []
        # alguns nodes (ex: VHS_VideoCombine) exportam widgets como dict nomeado
        by_name = raw if isinstance(raw, dict) else None
        widgets = [] if by_name else list(raw)
        wi = 0
        for inp in n.get("inputs", []):
            name = inp["name"]
            if "widget" in inp:
                if by_name is not None:
                    continue  # dict e tratado integralmente apos o loop
                if wi >= len(widgets):
                    continue  # widget opcional sem valor no export
                if inp.get("link") is not None:
                    # widget convertido em conexao: o link MANDA (o literal e' stale)
                    src, slot = trace_source(*links[inp["link"]], nodes_by_id=nodes_by_id,
                                             get_map=get_map, links=links)
                    inputs[name] = [str(src), slot]
                else:
                    inputs[name] = widgets[wi]
                wi += 1
                # seed carrega um "control_after_generate" fantasma logo apos
                if name in SEED_NAMES and wi < len(widgets) and widgets[wi] in (
                    "fixed", "increment", "decrement", "randomize"
                ):
                    wi += 1
            elif inp.get("link") is not None:
                src, slot = trace_source(*links[inp["link"]], nodes_by_id=nodes_by_id,
                                         get_map=get_map, links=links)
                inputs[name] = [str(src), slot]
            # sem link e sem widget -> input opcional desconectado: omite
        if by_name is not None:
            # widgets em dict (ex: VHS_VideoCombine): inclui tudo, menos artefatos de UI
            for k, v in by_name.items():
                if k != "videopreview" and k not in inputs:
                    inputs[k] = v
        api[str(n["id"])] = {"class_type": n["type"], "inputs": inputs}
    return api


def main():
    if len(sys.argv) != 3:
        print(__doc__)
        sys.exit(1)
    doc = json.load(open(sys.argv[1], encoding="utf-8"))
    api = convert(doc)
    with open(sys.argv[2], "w", encoding="utf-8") as f:
        json.dump(api, f, ensure_ascii=False, indent=2)
    print(f"{len(api)} nodes -> {sys.argv[2]}")


if __name__ == "__main__":
    main()
