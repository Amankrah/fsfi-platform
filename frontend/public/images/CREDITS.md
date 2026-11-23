# Image credits

Every photograph on the site comes from the verified list in `docs/design_research/FSFI_DESIGN_BRIEF.md` (§4.5). Each
was downloaded on 23 November 2026, inspected for flags, landmarks, legible signage, vehicle plates, identifiable
officials and anything else that could place it in a specific country, then cropped, resized, converted to WebP and
given the site treatment with `scripts/process-images.mjs`. The originals are not committed. All EXIF, XMP and IPTC
metadata (including any location fields) is removed by the conversion. Captions on the site describe the subject only
and never name a place.

Unsplash License: free for commercial and non-commercial use; attribution not required but given here
(<https://unsplash.com/license>).

| File | Subject | Photographer | Source | Licence | Treatment | Used on |
|---|---|---|---|---|---|---|
| `hero-grain-sifting.webp` | Two men sifting grain onto a pile (cropped below the faces) | Nasiru Othman | <https://unsplash.com/photos/men-sifting-grain-on-outdoor-pile-YIYSe_lLxnY> | Unsplash License | 21:9, desaturated to 30 %, blacks lifted, evergreen multiply overlay at 68 % | Landing hero |
| `header-irrigated-fields.webp` | Aerial view of fields, an irrigation ditch and a sprinkler | Bernd Dittrich | <https://unsplash.com/photos/aerial-view-of-agricultural-fields-irrigation-ditch-and-sprinkler-Gz-3pPHOKzw> | Unsplash License | 3:1, duotone #0F3D33 / #F6F1E7 | Method |
| `header-dried-maize.webp` | Dried maize cobs | Samuel Agyeman-Duah | <https://unsplash.com/photos/corn-on-gray-metal-tray-Gyxf5xtYkKI> | Unsplash License | 3:1, duotone | Country comparison |
| `header-budget-papers.webp` | Calculator on printed charts | Jakub Żerdzicki | <https://unsplash.com/photos/smartphone-calculator-app-on-financial-report-papers-4rTXOMv28VA> | Unsplash License | 3:1, duotone | Draft-budget scoring |
| `header-document-stacks.webp` | Stacks of paper documents and file folders | Wesley Tingey | <https://unsplash.com/photos/stacks-of-paper-documents-and-file-folders-snNHKZ-mGfE> | Unsplash License | 3:1, duotone | Data and downloads |
| `portrait-carrying-grain.webp` | Man in a straw hat carrying a sack | Nasiru Othman | <https://unsplash.com/photos/man-in-straw-hat-carrying-sack-OWlfU_l2MAQ> | Unsplash License | 4:5, duotone | About |

## Checked and not used

| Candidate (brief §4.5) | Reason |
|---|---|
| Two men sifting soybeans near white sacks (`qAAcVBTai8Y`) | Near-duplicate of the hero image |
| Person holding paper near pen and calculator (`xoU52jUVUXA`) | Legible national tax forms with a flag and a landmark building in frame |
| Baskets and sacks of dried shrimp and grains (`E4rwU6LDoiQ`) | Legible shop signage and printed sack text |
| A farmer tends to his crops (`1AoGjqdyDLU`) | Recognisable face and a location tag; not needed once the set was complete |
