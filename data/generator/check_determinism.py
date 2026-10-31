#!/usr/bin/env python3
"""Regenerates the demo fixtures twice into temp dirs and compares with the committed MANIFEST.sha256."""
import hashlib, os, subprocess, sys, tempfile

here = os.path.dirname(os.path.abspath(__file__))
gen = os.path.join(here, "generate_synthetic_profile.py")
committed = open(os.path.join(here, "..", "demo", "MANIFEST.sha256")).read()
for attempt in range(2):
    with tempfile.TemporaryDirectory() as tmp:
        subprocess.run([sys.executable, "-I", gen, "--out", tmp], check=True, stdout=subprocess.DEVNULL)
        fresh = open(os.path.join(tmp, "MANIFEST.sha256")).read()
        if fresh != committed:
            sys.exit("MISMATCH: regenerated fixtures differ from data/demo/MANIFEST.sha256")
print("OK: regeneration is byte-identical to committed fixtures (2 runs)")
