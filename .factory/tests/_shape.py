"""Template-shaped copies (TD-027): the template's self-tests copy the repo as if it were the template. In a project that copy
also carries project-owned state (app commands, project acceptance suites and baseline), which cannot run without the project's
dependencies. These helpers leave that state out so the copy tests the template machinery. A no-op in the template itself,
which has none of it."""
import json
import os

PROJECT_OWNED_PREFIXES = ("tests/acceptance/",)
PROJECT_OWNED_FILES = ("metrics/acceptance-baseline.json",)


def project_owned(rel):
    rel = rel.replace(os.sep, "/")
    return rel in PROJECT_OWNED_FILES or rel.startswith(PROJECT_OWNED_PREFIXES)


def blank_project_fields(dst):
    """Blank factory.json commands.* and acceptance.command/reference_command in the copy at dst."""
    path = os.path.join(dst, "factory.json")
    with open(path, encoding="utf-8") as fh:
        f = json.load(fh)
    for k in f.get("commands", {}):
        f["commands"][k] = ""
    for k in ("command", "reference_command"):
        if k in f.get("acceptance", {}):
            f["acceptance"][k] = ""
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(f, fh, indent=2)
        fh.write("\n")
