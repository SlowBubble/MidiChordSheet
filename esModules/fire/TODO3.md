* upsert for escape key should merge tie note if the tie note was unchanged

## Design for voices + parts meshing (Vopam).

* Call this data format Vopam
* Backed by json.
* yaml example:

```yaml
display:
  join:
    docs:
      - intro
      - v1
      - c1
      - outro
intro:
  layer:
    docs:
      - introMelody
      - introBass
introMelody:
  transpose:
    doc: introMelodyInF
    key: C
introMelodyInF:
  fetch:
    ref: bovsIntro
simpleBass:
  fetch:
    ref: simpleBassTemplate
introBass:
  decorate:
    chordDoc: introMelody
    styleDoc: simpleBass
```

* High-level meaning
```
display = intro + v1 + c1 + outro
intro = introMelody / introBass
introMelody = transpose(doc=introMelodyInF, key='C')
introMelodyInF = fetch(ref='bovsIntro')
introBass = decorate(chordDoc=introMelody, styleDoc=simpleBass)
simpleBass = fetch(ref='simpleBassTemplate')
```

### Top-level keys: doc names

* The top-level keys of a Vopam object are doc names; their corresponding values have type doc.
  - doc represents a k-by-n rectangle, where k is the number voices and n is the number of measures.
  - do we need top-level values with other types??
* The doc name, display, refers to the doc that is actually displayed.

### Top-level value: a function invocation that outputs a doc
* The top-level value should be an object with just 1 key, the name of a Vopam function.

### Vopam function
* join(docs : list<doc>) : doc
  - for now assume the docs have the same number of voices.
  - in the future, we can add blank voices if needed
    * blank means overwriting with rests if there is no data; don't overwrite otherwise.
* layer(docs : list<doc>) : doc
  - assume all docs have the same number of measures and same number pickup beats
  - in the future, we can add blank measures or pickup.
* fetch(ref : string) : doc
* decorate(chordDoc : doc, styleDoc : doc) : doc
* transpose(doc : doc, key : string) : doc

## Design of data models
* The base data model
  - used for mutation
    * insert notes
    * lengthen/shorten shorten
  - should be unaware of the ties and measures
* The data model for display and navigate.
  - in view mode, longest note is set to the time signature.
  - in edit mode, longest note is set to step / 2.
* longest note doesn't mean it should not split when not long enough.
  - there will be points that must split if the start or end is not at the right place.
