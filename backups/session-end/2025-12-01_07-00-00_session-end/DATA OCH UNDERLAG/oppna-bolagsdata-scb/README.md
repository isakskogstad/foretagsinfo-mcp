---
dataset_info:
  features:
  - name: ForAndrTyp
    dtype: int64
  - name: Foretagsnamn
    dtype: string
  - name: FtgStat
    dtype: int64
  - name: Gatuadress
    dtype: string
  - name: JEStat
    dtype: int64
  - name: JurForm
    dtype: int64
  - name: Namn
    dtype: string
  - name: Ng1
    dtype: int64
  - name: Ng2
    dtype: float64
  - name: Ng3
    dtype: float64
  - name: Ng4
    dtype: float64
  - name: Ng5
    dtype: float64
  - name: PeOrgNr
    dtype: int64
  - name: PostNr
    dtype: int64
  - name: PostOrt
    dtype: string
  - name: RegDatKtid
    dtype: float64
  - name: Reklamsparrtyp
    dtype: int64
  - name: mCOAdress
    dtype: int64
  - name: mForetagsnamn
    dtype: int64
  - name: mFtgStat
    dtype: int64
  - name: mGatuadress
    dtype: int64
  - name: mJEStat
    dtype: int64
  - name: mJurForm
    dtype: int64
  - name: mNamn
    dtype: int64
  - name: mNg1
    dtype: int64
  - name: mNg2
    dtype: int64
  - name: mNg3
    dtype: int64
  - name: mNg4
    dtype: int64
  - name: mNg5
    dtype: int64
  - name: mPostNr
    dtype: int64
  - name: mPostOrt
    dtype: int64
  - name: mRegDatKtid
    dtype: int64
  - name: mReklamsparrtyp
    dtype: int64
  - name: 'Unnamed: 34'
    dtype: float64
  - name: __index_level_0__
    dtype: int64
  splits:
  - name: train
    num_bytes: 364789930
    num_examples: 1162996
  download_size: 51437669
  dataset_size: 364789930
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

This dataset is a dump of SCB's registry over Swedish companies. It is downloaded from Bolagsverket's [website](https://bolagsverket.se/apierochoppnadata/nedladdningsbarafiler.2517.html) (SCB file) and converted thanks to this [script](https://github.com/PierreMesure/oppna-bolagsdata).

## License

Unfortunately, Bolagsverket and SCB aren't trying to follow open data best practices with this release, they are simply doing the bare minimum to respect the EU's requirements. So they don't disclose under which license they publish this data but the EU requires a license like CC-BY-4.0 at most so it's fair to assume that you can use this data if you attribute it to SCB and Bolagsverket.