---
title: The media library
summary: Images and downloads, uploaded once and used anywhere — kept in assets/uploads/, described with alt text, and never deleted while something still uses them without telling you.
section: media
order: 30
---
## Where media lives

An upload is an ordinary file in `assets/uploads/`, versioned and published like everything else. Its stored name carries a content hash — `team-4f2a9c1b0e.jpg` — so two uploads called `photo.jpg` never overwrite each other, and uploading the same file twice gives the same file.

Images in a theme's or addon's `assets/` are listed too, marked as theme images. They can be used and described, but not deleted: they belong to their package.

## What can be uploaded

- **Images**: PNG, JPG, GIF, WebP, AVIF — up to 10 MB.
- **Files** for [`file` fields](/docs/field-types/): PDF, ZIP, CSV, text, Word, Excel, PowerPoint, MP3, MP4, WebM — up to 25 MB.

The type is checked from the file's bytes, never its name: a script renamed `photo.png` is refused, a "PDF" that does not start like a PDF is refused, and nothing a browser would run — HTML, SVG, JavaScript — can be uploaded, since uploads are served from the site's own address.

## The Media screen

- **Upload** with the button, by dropping files anywhere on the page, or by pasting an image.
- **Filter** by *All*, *Uploads*, *Theme*, *Unused* or *No alt text*; **search** by name or alt text; **sort** by newest, name or size.
- **Select** an image to see its dimensions, size, type and date; copy its address or a markdown snippet; open the original.
- **Used in** lists every site file that mentions the image — entries link straight to their editor. Deleting an image in use says which files will show a broken image.

## Alt text

Every image has alt text, written once in the library and stored in `config/media.json`:

```json
{ "uploads/team-4f2a9c1b0e.jpg": { "alt": "The team at the 2026 offsite" } }
```

Wherever the image is used **without alt text of its own**, the library's is used:

- a markdown image `![](/assets/uploads/team-4f2a9c1b0e.jpg)` gets it when rendered;
- `image_tag` uses it when no alt is passed;
- `image_alt` returns it, for templates that write their own `<img>`;
- the SEO plugin writes it as `og:image:alt` and `twitter:image:alt` for the sharing image.

Alt text written where the image is used — `![Our team](…)`, `image_tag('Our team')` — always wins. In the content editor, select an image to give it its own alt text; left empty, it follows the library's, and keeps following when that changes.

The Media page's *No alt text* filter is the to-do list. Changing alt text rebuilds every page, since any of them may show the image.

## Picking media

Every image, gallery, file and video field opens the same library in a dialog: choose, or upload and choose, and set alt text on the spot.
