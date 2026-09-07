import { StateAdapter } from "./types";
import { ncAdapter } from "./nc";
import { npsAdapter } from "./nps";
import { nyAdapter } from "./ny";
import { mdAdapter } from "./md";
import { nvAdapter } from "./nv";
import { akAdapter } from "./ak";
import { waAdapter } from "./wa";
import { flAdapter } from "./fl";
import { caAdapter } from "./ca";
import { ilAdapter } from "./il";
import { iaAdapter } from "./ia";

export const ALL_ADAPTERS: StateAdapter[] = [
  npsAdapter,
  ncAdapter,
  nyAdapter,
  mdAdapter,
  nvAdapter,
  akAdapter,
  waAdapter,
  flAdapter,
  caAdapter,
  ilAdapter,
  iaAdapter
];
