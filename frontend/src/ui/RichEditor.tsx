/**
 * RichEditor — editor rich text basato su Quill 2.
 * Il CSS di Quill viene iniettato inline per evitare problemi di caricamento CDN.
 */
import * as React from 'react'
import { Box, CircularProgress } from '@mui/material'

interface Props {
  value: string
  onChange: (html: string) => void
  onImageUpload?: (file: File) => Promise<string>
  onWikiLink?: () => void // apre il dialog di ricerca pagine wiki
  /** Optional ref to access the underlying Quill instance (e.g. for inserting links). */
  quillRef?: React.MutableRefObject<QuillInstance | null>
  minHeight?: number
  placeholder?: string
  readOnly?: boolean
}

export type QuillInstance = {
  clipboard: { dangerouslyPasteHTML: (html: string) => void }
  history: { clear: () => void }
  on: (event: string, handler: () => void) => void
  getSelection: (focus: boolean) => { index: number; length?: number } | null
  getLength: () => number
  insertEmbed: (index: number, type: string, value: unknown) => void
  insertText: (index: number, text: string, formats?: string, value?: unknown) => void
  setSelection: (index: number) => void
  getSemanticHTML?: () => string
}

// ── CSS Quill snow + override (inline, nessuna dipendenza CDN) ─────────────────

// prettier-ignore
const QUILL_FULL_CSS = `
/* Quill core */
.ql-container{box-sizing:border-box;font-family:Helvetica,Arial,sans-serif;font-size:13px;height:100%;margin:0;position:relative}.ql-container.ql-disabled .ql-tooltip{visibility:hidden}.ql-container.ql-disabled .ql-editor ul[data-checked]>li::before{pointer-events:none}.ql-clipboard{left:-100000px;height:1px;overflow-y:hidden;position:absolute;top:50%}.ql-clipboard p{margin:0;padding:0}.ql-editor{box-sizing:border-box;line-height:1.42;height:100%;outline:none;overflow-y:auto;padding:12px 15px;tab-size:4;-moz-tab-size:4;text-align:left;white-space:pre-wrap;word-wrap:break-word}.ql-editor>*{cursor:text}.ql-editor p,.ql-editor ol,.ql-editor ul,.ql-editor pre,.ql-editor blockquote,.ql-editor h1,.ql-editor h2,.ql-editor h3,.ql-editor h4,.ql-editor h5,.ql-editor h6{margin:0;padding:0;counter-reset:list-1 list-2 list-3 list-4 list-5 list-6 list-7 list-8 list-9}.ql-editor ol,.ql-editor ul{padding-left:1.5em}.ql-editor ol>li,.ql-editor ul>li{list-style-type:none}.ql-editor ul>li::before{content:'\\2022'}.ql-editor ul[data-checked=true],.ql-editor ul[data-checked=false]{pointer-events:none}.ql-editor ul[data-checked=true]>li *,.ql-editor ul[data-checked=false]>li *{pointer-events:all}.ql-editor ul[data-checked=true]>li::before,.ql-editor ul[data-checked=false]>li::before{color:#777;cursor:pointer;pointer-events:all}.ql-editor ul[data-checked=true]>li::before{content:'\\2611'}.ql-editor ul[data-checked=false]>li::before{content:'\\2610'}.ql-editor li::before{display:inline-block;white-space:nowrap;width:1.2em}.ql-editor li:not(.ql-direction-rtl)::before{margin-left:-1.5em;margin-right:.3em;text-align:right}.ql-editor li.ql-direction-rtl::before{margin-left:.3em;margin-right:-1.5em}.ql-editor ol li:not(.ql-direction-rtl),.ql-editor ul li:not(.ql-direction-rtl){padding-left:1.5em}.ql-editor ol li.ql-direction-rtl,.ql-editor ul li.ql-direction-rtl{padding-right:1.5em}.ql-editor ol li{counter-reset:list-1 list-2 list-3 list-4 list-5 list-6 list-7 list-8 list-9;counter-increment:list-0}.ql-editor ol li:before{content:counter(list-0,decimal) '. '}.ql-editor ol li.ql-indent-1{counter-increment:list-1}.ql-editor ol li.ql-indent-1:before{content:counter(list-1,lower-alpha) '. '}.ql-editor ol li.ql-indent-1{counter-reset:list-2 list-3 list-4 list-5 list-6 list-7 list-8 list-9}.ql-editor ol li.ql-indent-2{counter-increment:list-2}.ql-editor ol li.ql-indent-2:before{content:counter(list-2,lower-roman) '. '}.ql-editor .ql-indent-1:not(.ql-direction-rtl){padding-left:3em}.ql-editor li.ql-indent-1:not(.ql-direction-rtl){padding-left:4.5em}.ql-editor .ql-indent-2:not(.ql-direction-rtl){padding-left:6em}.ql-editor li.ql-indent-2:not(.ql-direction-rtl){padding-left:7.5em}.ql-editor .ql-video{display:block;max-width:100%}.ql-editor .ql-video.ql-align-center{margin:0 auto}.ql-editor .ql-video.ql-align-right{margin:0 0 0 auto}.ql-editor .ql-bg-black{background-color:#000}.ql-editor .ql-bg-red{background-color:#e60000}.ql-editor .ql-bg-orange{background-color:#f90}.ql-editor .ql-bg-yellow{background-color:#ff0}.ql-editor .ql-bg-green{background-color:#008a00}.ql-editor .ql-bg-blue{background-color:#06c}.ql-editor .ql-bg-purple{background-color:#93f}.ql-editor .ql-color-white{color:#fff}.ql-editor .ql-color-red{color:#e60000}.ql-editor .ql-color-orange{color:#f90}.ql-editor .ql-color-yellow{color:#ff0}.ql-editor .ql-color-green{color:#008a00}.ql-editor .ql-color-blue{color:#06c}.ql-editor .ql-color-purple{color:#93f}.ql-editor .ql-font-serif{font-family:Georgia,Times New Roman,serif}.ql-editor .ql-font-monospace{font-family:Monaco,Courier New,monospace}.ql-editor .ql-size-small{font-size:.75em}.ql-editor .ql-size-large{font-size:1.5em}.ql-editor .ql-size-huge{font-size:2.5em}.ql-editor .ql-direction-rtl{direction:rtl;text-align:inherit}.ql-editor .ql-align-center{text-align:center}.ql-editor .ql-align-justify{text-align:justify}.ql-editor .ql-align-right{text-align:right}.ql-editor.ql-blank::before{color:rgba(0,0,0,.6);content:attr(data-placeholder);font-style:italic;left:15px;pointer-events:none;position:absolute;right:15px}

/* Quill snow theme */
.ql-toolbar.ql-snow{border:1px solid #ccc;box-sizing:border-box;font-family:'Helvetica Neue',Helvetica,Arial,sans-serif;padding:8px}.ql-toolbar.ql-snow .ql-formats{margin-right:15px;vertical-align:middle}.ql-toolbar.ql-snow .ql-picker-label{border:1px solid transparent}.ql-toolbar.ql-snow .ql-picker-options{border:1px solid transparent;box-shadow:rgba(0,0,0,.2) 0 2px 8px}.ql-toolbar.ql-snow .ql-picker.ql-expanded .ql-picker-label{border-color:#ccc}.ql-toolbar.ql-snow .ql-picker.ql-expanded .ql-picker-options{border-color:#ccc}.ql-toolbar.ql-snow .ql-color-picker .ql-picker-item.ql-selected,.ql-toolbar.ql-snow .ql-color-picker .ql-picker-item:hover{border-color:#000}.ql-toolbar.ql-snow+.ql-container.ql-snow{border-top:0}.ql-snow .ql-tooltip{background-color:#fff;border:1px solid #ccc;box-shadow:0 0 5px #ddd;color:#444;padding:5px 12px;white-space:nowrap}.ql-snow .ql-tooltip::before{content:"Visit URL:";line-height:26px;margin-right:8px}.ql-snow .ql-tooltip input[type=text]{display:none;border:1px solid #ccc;font-size:13px;height:26px;margin:0;padding:3px 5px;width:170px}.ql-snow .ql-tooltip.ql-editing input[type=text]{display:inline-block}.ql-snow .ql-tooltip.ql-editing a.ql-preview,.ql-snow .ql-tooltip.ql-editing a.ql-remove{display:none}.ql-snow .ql-tooltip a.ql-preview{display:inline-block;max-width:200px;overflow-x:hidden;text-overflow:ellipsis;vertical-align:top}.ql-snow .ql-tooltip a.ql-action::after{border-right:1px solid #ccc;content:'Edit';margin-left:16px;padding-right:8px}.ql-snow .ql-tooltip a.ql-remove::before{content:'Remove';margin-left:8px}.ql-snow .ql-tooltip a{line-height:26px}.ql-snow .ql-tooltip.ql-editing a.ql-action::after{border-right:0;content:'Save';padding-right:0}.ql-snow .ql-picker{color:#444;display:inline-block;float:left;font-size:14px;font-weight:500;height:24px;position:relative;vertical-align:middle}.ql-snow .ql-picker-label{cursor:pointer;display:inline-block;height:100%;padding-left:8px;padding-right:2px;position:relative;width:100%}.ql-snow .ql-picker-label::before{display:inline-block;line-height:22px}.ql-snow .ql-picker-options{background-color:#fff;display:none;min-width:100%;padding:4px 8px;position:absolute;white-space:nowrap;z-index:1}.ql-snow .ql-picker-options .ql-picker-item{cursor:pointer;display:block;padding-bottom:5px;padding-top:5px}.ql-snow .ql-picker.ql-expanded .ql-picker-label{color:#ccc;z-index:2}.ql-snow .ql-picker.ql-expanded .ql-picker-label .ql-fill{fill:#ccc}.ql-snow .ql-picker.ql-expanded .ql-picker-label .ql-stroke{stroke:#ccc}.ql-snow .ql-picker.ql-expanded .ql-picker-options{display:block;margin-top:-1px;top:100%;z-index:1}.ql-snow .ql-color-picker,.ql-snow .ql-icon-picker{width:28px}.ql-snow .ql-color-picker .ql-picker-label,.ql-snow .ql-icon-picker .ql-picker-label{padding:2px 4px}.ql-snow .ql-color-picker .ql-picker-label svg,.ql-snow .ql-icon-picker .ql-picker-label svg{right:4px}.ql-snow .ql-icon-picker .ql-picker-options{padding:4px 0}.ql-snow .ql-icon-picker .ql-picker-item{height:24px;width:24px;padding:2px 4px}.ql-snow .ql-color-picker .ql-picker-options{padding:3px 5px;width:152px}.ql-snow .ql-color-picker .ql-picker-item{border:1px solid transparent;float:left;height:16px;margin:2px;padding:0;width:16px}.ql-snow .ql-picker:not(.ql-color-picker):not(.ql-icon-picker) svg{position:absolute;margin-top:-9px;right:0;top:50%;width:18px}.ql-snow .ql-picker.ql-header .ql-picker-label[data-label]:not([data-label=''])::before,.ql-snow .ql-picker.ql-font .ql-picker-label[data-label]:not([data-label=''])::before,.ql-snow .ql-picker.ql-size .ql-picker-label[data-label]:not([data-label=''])::before,.ql-snow .ql-picker.ql-align .ql-picker-label[data-label]:not([data-label=''])::before{content:attr(data-label)}.ql-snow .ql-picker.ql-header{width:98px}.ql-snow .ql-picker.ql-header .ql-picker-label::before,.ql-snow .ql-picker.ql-header .ql-picker-item::before{content:'Normal'}.ql-snow .ql-picker.ql-header .ql-picker-label[data-value="1"]::before,.ql-snow .ql-picker.ql-header .ql-picker-item[data-value="1"]::before{content:'Heading 1'}.ql-snow .ql-picker.ql-header .ql-picker-label[data-value="2"]::before,.ql-snow .ql-picker.ql-header .ql-picker-item[data-value="2"]::before{content:'Heading 2'}.ql-snow .ql-picker.ql-header .ql-picker-label[data-value="3"]::before,.ql-snow .ql-picker.ql-header .ql-picker-item[data-value="3"]::before{content:'Heading 3'}.ql-snow .ql-picker.ql-header .ql-picker-item[data-value="1"]::before{font-size:2em}.ql-snow .ql-picker.ql-header .ql-picker-item[data-value="2"]::before{font-size:1.5em}.ql-snow .ql-picker.ql-header .ql-picker-item[data-value="3"]::before{font-size:1.17em}.ql-snow .ql-picker.ql-font{width:108px}.ql-snow .ql-picker.ql-font .ql-picker-label::before,.ql-snow .ql-picker.ql-font .ql-picker-item::before{content:'Sans Serif'}.ql-snow .ql-picker.ql-font .ql-picker-label[data-value=serif]::before,.ql-snow .ql-picker.ql-font .ql-picker-item[data-value=serif]::before{content:'Serif';font-family:Georgia,Times New Roman,serif}.ql-snow .ql-picker.ql-font .ql-picker-label[data-value=monospace]::before,.ql-snow .ql-picker.ql-font .ql-picker-item[data-value=monospace]::before{content:'Monospace';font-family:Monaco,Courier New,monospace}.ql-snow .ql-picker.ql-size{width:98px}.ql-snow .ql-picker.ql-size .ql-picker-label::before,.ql-snow .ql-picker.ql-size .ql-picker-item::before{content:'Normal'}.ql-snow .ql-picker.ql-size .ql-picker-label[data-value=small]::before,.ql-snow .ql-picker.ql-size .ql-picker-item[data-value=small]::before{content:'Small'}.ql-snow .ql-picker.ql-size .ql-picker-label[data-value=large]::before,.ql-snow .ql-picker.ql-size .ql-picker-item[data-value=large]::before{content:'Large'}.ql-snow .ql-picker.ql-size .ql-picker-label[data-value=huge]::before,.ql-snow .ql-picker.ql-size .ql-picker-item[data-value=huge]::before{content:'Huge'}.ql-snow .ql-color-picker.ql-background .ql-picker-label svg,.ql-snow .ql-color-picker.ql-color .ql-picker-label svg{top:2px}.ql-snow .ql-align{width:28px}.ql-snow .ql-align .ql-picker-label svg,.ql-snow .ql-align .ql-picker-item svg{position:static;height:18px;width:18px}.ql-snow .ql-align .ql-picker-options{width:104px;text-align:left}.ql-snow .ql-align .ql-picker-options .ql-picker-item{height:24px;width:24px;display:inline-block;float:left;padding:0 2px}.ql-snow.ql-toolbar button,.ql-snow .ql-toolbar button{background:none;border:none;cursor:pointer;display:inline-block;float:left;height:24px;padding:3px 5px;width:28px}.ql-snow.ql-toolbar button svg,.ql-snow .ql-toolbar button svg{float:left;height:100%}.ql-snow.ql-toolbar button:active:hover,.ql-snow .ql-toolbar button:active:hover{outline:none}.ql-snow.ql-toolbar input.ql-image[type=file],.ql-snow .ql-toolbar input.ql-image[type=file]{display:none}.ql-snow.ql-toolbar button:hover,.ql-snow .ql-toolbar button:hover,.ql-snow.ql-toolbar button:focus,.ql-snow .ql-toolbar button:focus,.ql-snow.ql-toolbar button.ql-active,.ql-snow .ql-toolbar button.ql-active,.ql-snow.ql-toolbar .ql-picker-label:hover,.ql-snow .ql-toolbar .ql-picker-label:hover,.ql-snow.ql-toolbar .ql-picker-label.ql-active,.ql-snow .ql-toolbar .ql-picker-label.ql-active,.ql-snow.ql-toolbar .ql-picker-item:hover,.ql-snow .ql-toolbar .ql-picker-item:hover,.ql-snow.ql-toolbar .ql-picker-item.ql-selected,.ql-snow .ql-toolbar .ql-picker-item.ql-selected{color:#06c}.ql-snow.ql-toolbar button:hover .ql-fill,.ql-snow .ql-toolbar button:hover .ql-fill,.ql-snow.ql-toolbar button:focus .ql-fill,.ql-snow .ql-toolbar button:focus .ql-fill,.ql-snow.ql-toolbar button.ql-active .ql-fill,.ql-snow .ql-toolbar button.ql-active .ql-fill,.ql-snow.ql-toolbar .ql-picker-label:hover .ql-fill,.ql-snow .ql-toolbar .ql-picker-label:hover .ql-fill,.ql-snow.ql-toolbar .ql-picker-label.ql-active .ql-fill,.ql-snow .ql-toolbar .ql-picker-label.ql-active .ql-fill,.ql-snow.ql-toolbar .ql-picker-item:hover .ql-fill,.ql-snow .ql-toolbar .ql-picker-item:hover .ql-fill,.ql-snow.ql-toolbar .ql-picker-item.ql-selected .ql-fill,.ql-snow .ql-toolbar .ql-picker-item.ql-selected .ql-fill{fill:#06c}.ql-snow.ql-toolbar button:hover .ql-stroke,.ql-snow .ql-toolbar button:hover .ql-stroke,.ql-snow.ql-toolbar button:focus .ql-stroke,.ql-snow .ql-toolbar button:focus .ql-stroke,.ql-snow.ql-toolbar button.ql-active .ql-stroke,.ql-snow .ql-toolbar button.ql-active .ql-stroke,.ql-snow.ql-toolbar .ql-picker-label:hover .ql-stroke,.ql-snow .ql-toolbar .ql-picker-label:hover .ql-stroke,.ql-snow.ql-toolbar .ql-picker-label.ql-active .ql-stroke,.ql-snow .ql-toolbar .ql-picker-label.ql-active .ql-stroke,.ql-snow.ql-toolbar .ql-picker-item:hover .ql-stroke,.ql-snow .ql-toolbar .ql-picker-item:hover .ql-stroke,.ql-snow.ql-toolbar .ql-picker-item.ql-selected .ql-stroke,.ql-snow .ql-toolbar .ql-picker-item.ql-selected .ql-stroke{stroke:#06c}.ql-snow.ql-toolbar button:hover .ql-stroke-miter,.ql-snow .ql-toolbar button:hover .ql-stroke-miter,.ql-snow.ql-toolbar button:focus .ql-stroke-miter,.ql-snow .ql-toolbar button:focus .ql-stroke-miter,.ql-snow.ql-toolbar button.ql-active .ql-stroke-miter,.ql-snow .ql-toolbar button.ql-active .ql-stroke-miter,.ql-snow.ql-toolbar .ql-picker-label:hover .ql-stroke-miter,.ql-snow .ql-toolbar .ql-picker-label:hover .ql-stroke-miter,.ql-snow.ql-toolbar .ql-picker-label.ql-active .ql-stroke-miter,.ql-snow .ql-toolbar .ql-picker-label.ql-active .ql-stroke-miter,.ql-snow.ql-toolbar .ql-picker-item:hover .ql-stroke-miter,.ql-snow .ql-toolbar .ql-picker-item:hover .ql-stroke-miter,.ql-snow.ql-toolbar .ql-picker-item.ql-selected .ql-stroke-miter,.ql-snow .ql-toolbar .ql-picker-item.ql-selected .ql-stroke-miter{stroke:#06c}@media (pointer:coarse){.ql-snow.ql-toolbar button:hover:not(.ql-active),.ql-snow .ql-toolbar button:hover:not(.ql-active){color:#444}.ql-snow.ql-toolbar button:hover:not(.ql-active) .ql-fill,.ql-snow .ql-toolbar button:hover:not(.ql-active) .ql-fill{fill:#444}.ql-snow.ql-toolbar button:hover:not(.ql-active) .ql-stroke,.ql-snow .ql-toolbar button:hover:not(.ql-active) .ql-stroke{stroke:#444}.ql-snow.ql-toolbar button:hover:not(.ql-active) .ql-stroke-miter,.ql-snow .ql-toolbar button:hover:not(.ql-active) .ql-stroke-miter{stroke:#444}}.ql-snow .ql-stroke{fill:none;stroke:#444;stroke-linecap:round;stroke-linejoin:round;stroke-width:2}.ql-snow .ql-stroke-miter{fill:none;stroke:#444;stroke-miterlimit:10;stroke-width:2}.ql-snow .ql-fill,.ql-snow .ql-stroke.ql-fill{fill:#444}.ql-snow .ql-empty{fill:none}.ql-snow .ql-even{fill-rule:evenodd}.ql-snow .ql-thin,.ql-snow .ql-stroke.ql-thin{stroke-width:1}.ql-snow .ql-transparent{opacity:.4}.ql-snow .ql-direction svg:last-child{display:none}.ql-snow .ql-direction.ql-active svg:last-child{display:inline}.ql-snow .ql-editor h1{font-size:2em}.ql-snow .ql-editor h2{font-size:1.5em}.ql-snow .ql-editor h3{font-size:1.17em}.ql-snow .ql-editor h4{font-size:1em}.ql-snow .ql-editor h5{font-size:.83em}.ql-snow .ql-editor h6{font-size:.67em}.ql-snow .ql-editor a{text-decoration:underline}.ql-snow .ql-editor blockquote{border-left:4px solid #ccc;margin-bottom:5px;margin-top:5px;padding-left:16px}.ql-snow .ql-editor code,.ql-snow .ql-editor pre{background-color:#f0f0f0;border-radius:3px}.ql-snow .ql-editor pre{white-space:pre-wrap;margin-bottom:5px;margin-top:5px;padding:5px 10px}.ql-snow .ql-editor code{font-size:85%;padding:2px 4px}.ql-snow .ql-editor pre.ql-syntax{background-color:#23241f;color:#f8f8f2;overflow:visible}.ql-snow .ql-editor img{max-width:100%}.ql-snow .ql-picker.ql-header .ql-picker-item::before{font-size:14px}.ql-snow{box-sizing:border-box}.ql-snow *{box-sizing:border-box}.ql-snow .ql-hidden{display:none}.ql-snow .ql-out-bottom,.ql-snow .ql-out-top{visibility:hidden}.ql-snow .ql-tooltip{position:absolute;transform:translateY(10px)}.ql-snow .ql-tooltip a{cursor:pointer;text-decoration:none}.ql-snow .ql-tooltip.ql-flip{transform:translateY(-10px)}.ql-snow .ql-formats{display:inline-block;vertical-align:middle}.ql-snow .ql-formats:after{clear:both;content:'';display:table}.ql-snow .ql-stroke{fill:none;stroke:#444;stroke-linecap:round;stroke-linejoin:round;stroke-width:2}.ql-snow .ql-stroke-miter{fill:none;stroke:#444;stroke-miterlimit:10;stroke-width:2}.ql-snow .ql-fill,.ql-snow .ql-stroke.ql-fill{fill:#444}.ql-snow .ql-empty{fill:none}.ql-snow .ql-even{fill-rule:evenodd}.ql-snow .ql-thin,.ql-snow .ql-stroke.ql-thin{stroke-width:1}.ql-snow .ql-transparent{opacity:.4}.ql-snow .ql-direction svg:last-child{display:none}.ql-snow .ql-direction.ql-active svg:last-child{display:inline}

/* ── Override colori app ─── */
.ql-toolbar.ql-snow {
  border: none !important;
  border-bottom: 1px solid #e5e7eb !important;
  background: #f9fafb;
  padding: 8px 12px;
  flex-wrap: wrap;
}
.ql-container.ql-snow {
  border: none !important;
  font-family: Inter, -apple-system, sans-serif;
  font-size: 14px;
}
.ql-editor {
  line-height: 1.75;
  color: #1a2421;
  padding: 20px 24px;
}
.ql-editor.ql-blank::before {
  color: #9ca3af;
  font-style: normal;
}
.ql-editor h1 { font-size: 24px !important; font-weight: 800; margin: 16px 0 8px; letter-spacing: -0.02em; }
.ql-editor h2 { font-size: 20px !important; font-weight: 700; margin: 14px 0 6px; }
.ql-editor h3 { font-size: 16px !important; font-weight: 700; margin: 12px 0 4px; }
.ql-editor blockquote {
  border-left: 3px solid #0f766e !important;
  color: #4a6560;
  font-style: italic;
  border-right: none !important;
  margin: 12px 0;
  padding-left: 16px;
}
.ql-editor pre.ql-syntax {
  background: #1a2421 !important;
  color: #a7f3d0 !important;
  border-radius: 8px;
  padding: 16px 20px;
  font-family: 'JetBrains Mono', Menlo, monospace;
  font-size: 13px;
}
.ql-editor img { border-radius: 8px; margin: 8px 0; }
.ql-editor a { color: #0f766e; }
.ql-editor ::selection { background: #31b2a6; color: #fff; }
.ql-editor ::-moz-selection { background: #31b2a6; color: #fff; }
/* Wiki link button */
.ql-wiki-link::before { content: "⧉"; font-size: 14px; line-height: 24px; font-weight: 700; color: #0f766e; }
.ql-wiki-link:hover::before { color: #0f766e; }
.ql-snow.ql-toolbar button:hover .ql-stroke,
.ql-snow.ql-toolbar button.ql-active .ql-stroke,
.ql-snow .ql-toolbar button:hover .ql-stroke,
.ql-snow .ql-toolbar button.ql-active .ql-stroke { stroke: #0f766e !important; }
.ql-snow.ql-toolbar button:hover .ql-fill,
.ql-snow.ql-toolbar button.ql-active .ql-fill,
.ql-snow .ql-toolbar button:hover .ql-fill,
.ql-snow .ql-toolbar button.ql-active .ql-fill { fill: #0f766e !important; }
.ql-snow.ql-toolbar button:hover,
.ql-snow .ql-toolbar button:hover,
.ql-snow.ql-toolbar button.ql-active,
.ql-snow .ql-toolbar button.ql-active {
  background: #f0fdf9;
  border-radius: 4px;
}
.ql-snow.ql-toolbar .ql-picker-label:hover,
.ql-snow .ql-toolbar .ql-picker-label:hover,
.ql-snow.ql-toolbar .ql-picker-label.ql-active,
.ql-snow .ql-toolbar .ql-picker-label.ql-active { color: #0f766e !important; }
.ql-snow .ql-picker-options { border-radius: 8px; box-shadow: 0 4px 16px rgba(0,0,0,0.12); }
`

let cssInjected = false
function injectCss() {
  if (cssInjected) return
  cssInjected = true
  const style = document.createElement('style')
  style.textContent = QUILL_FULL_CSS
  document.head.appendChild(style)
}

// ── Quill lazy loader ─────────────────────────────────────────────────────────

let quillPromise: Promise<typeof import('quill').default> | null = null
function loadQuill() {
  if (!quillPromise) {
    quillPromise = import('quill').then((m) => m.default ?? m)
  }
  return quillPromise
}

// ── Toolbar ───────────────────────────────────────────────────────────────────

const TOOLBAR = [
  [{ header: [1, 2, 3, false] }],
  ['bold', 'italic', 'underline', 'strike'],
  [{ color: [] }, { background: [] }],
  [{ align: [] }],
  [{ list: 'ordered' }, { list: 'bullet' }],
  ['blockquote', 'code-block'],
  ['link', 'image', 'wiki-link'],
  ['clean'],
]

// ── Component ─────────────────────────────────────────────────────────────────

// prettier-ignore
export default function RichEditor({
  value,
  onChange,
  onImageUpload,
  onWikiLink,
  quillRef,
  minHeight = 400,
  placeholder = 'Scrivi il contenuto della pagina…',
  readOnly = false,
}: Props) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const internalQuillRef = React.useRef<QuillInstance | null>(null)
  const fileInputRef = React.useRef<HTMLInputElement>(null)
  const [loading, setLoading] = React.useState(true)
  const [uploading, setUploading] = React.useState(false)

  // Refs stabili per callbacks che cambiano spesso
  const onChangeRef = React.useRef(onChange)
  const onImageUploadRef = React.useRef(onImageUpload)
  const onWikiLinkRef = React.useRef(onWikiLink)
  React.useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])
  React.useEffect(() => {
    onImageUploadRef.current = onImageUpload
  }, [onImageUpload])
  React.useEffect(() => {
    onWikiLinkRef.current = onWikiLink
  }, [onWikiLink])

  // ── Init Quill ─────────────────────────────────────────────────────────────

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return
    injectCss()

    let cancelled = false

    loadQuill().then((Quill) => {
      if (cancelled || !container.isConnected) return

      const editorEl = document.createElement('div')
      container.appendChild(editorEl)

      type QuillCtor = new (
        el: HTMLElement,
        options: Record<string, unknown>,
      ) => QuillInstance

      const QuillCtor = Quill as unknown as QuillCtor
      const quill = new QuillCtor(editorEl, {
        theme: 'snow',
        placeholder,
        readOnly,
        modules: {
          toolbar: readOnly
            ? false
            : {
                container: TOOLBAR,
                handlers: {
                  image: () => {
                    if (onImageUploadRef.current) {
                      fileInputRef.current?.click()
                    } else {
                      const url = window.prompt('URL immagine:')
                      if (url) {
                        const range = quill.getSelection(true)
                        const idx = range?.index ?? quill.getLength()
                        quill.insertEmbed(idx, 'image', url)
                      }
                    }
                  },
                  'wiki-link': () => {
                    onWikiLinkRef.current?.()
                  },
                },
              },
          history: { delay: 1000, maxStack: 100, userOnly: true },
        },
      } as Record<string, unknown>)

      internalQuillRef.current = quill
      if (quillRef) quillRef.current = quill
      setLoading(false)

      // Contenuto iniziale
      if (value) {
        quill.clipboard.dangerouslyPasteHTML(value)
        quill.history.clear()
      }

      // Listener
      quill.on('text-change', () => {
        const html: string =
          quill.getSemanticHTML?.() ?? editorEl.querySelector('.ql-editor')?.innerHTML ?? ''
        const norm = html === '<p><br></p>' || html === '<p></p>' ? '' : html
        onChangeRef.current(norm)
      })
    })

    return () => {
      cancelled = true
      container.innerHTML = ''
      internalQuillRef.current = null
      if (quillRef) quillRef.current = null
      setLoading(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [readOnly, placeholder])

  // ── Sync valore esterno ────────────────────────────────────────────────────

  const prevValue = React.useRef(value)
  React.useEffect(() => {
    const q = internalQuillRef.current
    if (!q) return
    if (value !== prevValue.current) {
      const currentHtml = q.getSemanticHTML?.() ?? ''
      if (value !== currentHtml) {
        q.clipboard.dangerouslyPasteHTML(value || '')
        q.history?.clear()
      }
    }
    prevValue.current = value
  }, [value])

  // ── Image upload ───────────────────────────────────────────────────────────

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !onImageUpload || !internalQuillRef.current) return
    setUploading(true)
    try {
      const url = await onImageUpload(file)
      const range = internalQuillRef.current.getSelection(true)
      internalQuillRef.current.insertEmbed(range?.index ?? 0, 'image', url)
    } catch {
      // toast gestito dal parent
    } finally {
      setUploading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <Box
      sx={{
        border: '1px solid',
        borderColor: 'divider',
        borderRadius: 2,
        overflow: 'hidden',
        bgcolor: 'background.paper',
        position: 'relative',
      }}
    >
      {loading && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 2,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'background.paper',
          }}
        >
          <CircularProgress size={24} />
        </Box>
      )}

      {uploading && (
        <Box
          sx={{
            position: 'absolute',
            inset: 0,
            zIndex: 3,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'rgba(255,255,255,0.8)',
          }}
        >
          <CircularProgress size={28} />
        </Box>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      <Box
        ref={containerRef}
        sx={{
          '& .ql-editor': { minHeight },
          '& .ql-toolbar': { display: readOnly ? 'none' : undefined },
        }}
      />
    </Box>
  )
}
