---
dataset_info:
  features:
  - name: organisationsidentitet
    dtype: string
  - name: namnskyddslopnummer
    dtype: float64
  - name: registreringsland
    dtype: string
  - name: organisationsnamn
    dtype: string
  - name: organisationsform
    dtype: string
  - name: avregistreringsdatum
    dtype: string
  - name: avregistreringsorsak
    dtype: string
  - name: pagandeAvvecklingsEllerOmstruktureringsforfarande
    dtype: string
  - name: registreringsdatum
    dtype: string
  - name: verksamhetsbeskrivning
    dtype: string
  - name: postadress
    dtype: string
  - name: __index_level_0__
    dtype: int64
  splits:
  - name: train
    num_bytes: 679383044
    num_examples: 1883264
  download_size: 233297195
  dataset_size: 679383044
configs:
- config_name: default
  data_files:
  - split: train
    path: data/train-*
license: cc-by-4.0
language:
- sv
tags:
- sweden
- company
- corporate
- beneficial-ownership
pretty_name: Öppna bolagsdata
size_categories:
- 1M<n<10M
---

# Öppna bolagsdata

This dataset is a dump of SCB's registry over Swedish companies. It is downloaded from Bolagsverket's [website](https://bolagsverket.se/apierochoppnadata/nedladdningsbarafiler.2517.html) (Bolagsverket file) and converted thanks to this [script](https://github.com/PierreMesure/oppna-bolagsdata).

## License

Unfortunately, Bolagsverket and SCB aren't trying to follow open data best practices with this release, they are simply doing the bare minimum to respect the EU's requirements. So they don't disclose under which license they publish this data but the EU requires a license like CC-BY-4.0 at most so it's fair to assume that you can use this data if you attribute it to SCB and Bolagsverket.