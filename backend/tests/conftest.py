import os
import shutil
import sys
from pathlib import Path

import pytest

BACKEND = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(BACKEND))
REPRO = BACKEND.parents[1] / "docs" / "paper" / "public_release" / "fsfsi-reproduction"


@pytest.fixture(scope="session", autouse=True)
def data_dir(tmp_path_factory):
    """Run against a private copy of the country store so tests never touch data/countries."""
    d = tmp_path_factory.mktemp("countries")
    src = BACKEND / "data" / "countries"
    if src.exists():
        for f in src.glob("*.json"):
            if f.stem in ("aurelia", "borealis", "cordova", "deltana"):
                shutil.copy(f, d / f.name)
    os.environ["FSFI_DATA_DIR"] = str(d)
    from fsfi_platform import store

    store.ensure_synthetic()
    return d


@pytest.fixture(scope="session")
def orig():
    """The published reference implementation (fsfsi_reference.model), when the reproduction package is present."""
    if not (REPRO / "fsfsi_reference" / "model.py").exists():
        pytest.skip("reproduction package not available")
    sys.path.insert(0, str(REPRO))
    import fsfsi_reference.model as M

    return M


@pytest.fixture(scope="session")
def profiles(data_dir):
    from fsfi_platform import store

    return {cid: store.get(cid) for cid in ("aurelia", "borealis", "cordova", "deltana")}


@pytest.fixture(scope="session")
def client(data_dir):
    from fastapi.testclient import TestClient

    from fsfi_platform.main import app

    with TestClient(app) as c:
        yield c
