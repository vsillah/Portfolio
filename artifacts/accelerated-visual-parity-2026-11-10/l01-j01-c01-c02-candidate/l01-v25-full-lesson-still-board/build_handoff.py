#!/usr/bin/env python3
"""Reframe verified L01 Decision File source art for the local 344s still only."""
import hashlib
import importlib.util
from pathlib import Path

from PIL import Image

HERE = Path(__file__).resolve().parent
SOURCE = HERE / 'decision-file-approved-source-crop.png'
SOURCE_SHA = '3dc3c8501c2c0720cb7a10c775b703539255bad541e9d59e38b2b640399c7792'
V24_BUILD = HERE.parent / 'l01-v24-approved-art-still-review/build.py'


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def fit_on_navy(art, mobile):
    picture = Image.new('RGB', (1280, 720), (9, 30, 40))
    if mobile:
        art = art.crop((80, 0, 1080, 526))
        art = art.resize((1280, 673), Image.Resampling.LANCZOS)
        picture.paste(art, (0, 23))
    else:
        art = art.resize((1210, 493), Image.Resampling.LANCZOS)
        picture.paste(art, (35, 113))
    return picture


def main():
    assert SOURCE.is_file() and sha(SOURCE) == SOURCE_SHA, 'approved source crop drift'
    spec = importlib.util.spec_from_file_location('v24_player', V24_BUILD)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.preflight()
    assert module.cue_at(344).strip() == 'of your decision file.'
    art = Image.open(SOURCE).convert('RGB')
    assert art.size == (1292, 526)
    for viewport, width in (('desktop', 1280), ('390x844', 352)):
        picture = fit_on_navy(art, viewport == '390x844')
        for captions in (False, True):
            image = module.player(picture, 344.0, width, captions)
            if viewport == '390x844':
                screen = Image.new('RGB', (390, 844), (12, 17, 22))
                screen.paste(image, (19, 200))
                image = screen
            dest = HERE / f'C02-handoff-{viewport}-captions-{"on" if captions else "off"}.png'
            image.save(dest, optimize=True)
    print('built four 344s handoff stills from verified Decision File source crop')


if __name__ == '__main__':
    main()
