# Accelerated curriculum phase 1

This is the book-faithful outline for a self-paced video workshop and four-session facilitated cohort. It is a source and production plan, not a finished script or a video approval packet.

- [Book crosswalk](book-crosswalk.md): every numbered EPUB chapter, disposition, and lesson location.
- [EPUB section-label inventory](epub-section-index.md): all 206 bold-styled internal section labels found by parsing the chapter XHTML, with the formatting limit stated in the file.
- [Video workshop outline](video-workshop-outline.md): 16 lessons, learner artifacts, visual direction, and 161-minute recorded runtime.
- [Production and provenance](production-and-provenance.md): SAM map, later script/storyboard/HeyGen boundaries, source register, and editorial decisions.

Run `python3 docs/accelerated-course-modules/curriculum/validate.py` from the repository root. The validator checks coverage, lesson fields, order, and timing. The canonical EPUB itself was inspected separately with EbookLib and an XHTML parser; its 26 exact chapter titles matched the crosswalk. The validator does not need a local EPUB copy to run in CI or on another machine.

**Phase boundary:** Later writers should use the EPUB, not this outline, for exact claims and spoken copy. No provider call, media generation, external publish, or production change is authorized by these files.
