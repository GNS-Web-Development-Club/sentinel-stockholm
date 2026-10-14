# SENTINEL survey chart

Interactive demonstration dashboard for SENTINEL, a multimodal deep learning system for freshwater contamination early warning. SENTINEL fuses five sensing modalities (physicochemical sensors, satellite imagery, microbial community profiles, molecular toxicogenomics and organism behavioural assays) through a Perceiver IO architecture. This site is the Stockholm Junior Water Prize 2026 demo; the paper and model code live at <https://github.com/austinjin1/SENTINEL-STOCKHOLM>.

The chart shows monitoring sites on a map, replays real past contamination events with a time slider and story playback, and shows how the cascade controller escalates through modality tiers. All data is local mock or cached data (`src/mockData.ts`, `src/data/*`); there is no backend. Optional live requests go to USGS NWIS (sensor readings) and NASA GIBS / Worldview (imagery) only when a feature asks for them.

Built with Vite, React 19, TypeScript, maplibre-gl and h3-js.

## Running

```bash
npm install
npm run dev
npm run build
```

`npm run preview` serves the production build locally.

## Authors

Bryan Cheng
