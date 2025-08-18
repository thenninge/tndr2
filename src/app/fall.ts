import type { FallObs } from "./types";
import type { Trekkrute } from "./types";

export const FALL: FallObs[] = [
  {
    dato: "2024-10-17",
    lat: 60.73301809029618,
    lng: 9.019656929449049,
    type: "okse",
    retning: "vest",
    antall: 1,
    kategori: "obs",
    person: ""
  },
  {
    dato: "2024-10-10",
    lat: 60.736518423107206,
    lng: 9.03894090048685,
    type: "Ku+kalv",
    retning: "nord",
    antall: 2,
    kategori: "obs",
    person: ""
  },
  {
    dato: "2024-10-20",
    lat: 60.73779639070775,
    lng: 9.042878554399381,
    type: "okse",
    retning: "nord vest",
    antall: 1,
    kategori: "obs",
    person: ""
  },
  {
    dato: "2024-10-20",
    lat: 60.73782766727721,
    lng: 9.042443431633883,
    type: "okse",
    retning: "nord vest",
    antall: 1,
    kategori: "fall",
    person: "2-Alfa"
  },
  {
    dato: "2024-11-30",
    lat: 60.7387916605757,
    lng: 9.038090799738619,
    type: "okse",
    retning: "nord øst",
    antall: 2,
    kategori: "obs",
    person: ""
  },
  {
    dato: "2024-10-22",
    lat: 60.717670198398096,
    lng: 9.008809339491473,
    type: "ukjent",
    retning: "ukjent",
    antall: 1,
    kategori: "obs",
    person: ""
  },
  {
    dato: "2024-10-22",
    lat: 60.71572377971269,
    lng: 9.018696886160615,
    type: "ungdyr",
    retning: "øst",
    antall: 1,
    kategori: "obs",
    person: ""
  },
  {
    dato: "2024-10-18",
    lat: 60.73555653464701,
    lng: 9.031444561542749,
    type: "ungdyr",
    retning: "vest",
    antall: 2,
    kategori: "obs",
    person: ""
  }
];

export const TREKKRUTER: Trekkrute[] = [
  {
    navn: "Røytjern-Avgang",
    fraPost: "Røytjern",
    tilPost: "Avgang",
    beskrivelse: "Klassisk trekk over myrdraget nord for Avgang, ofte brukt ved nordlig vind.",
    retning: "nord",
    terreng: ["myr", "skog"],
    ekstra: "Elgen følger ofte kanten av myra og krysser veien ved Avgang."
  },
  {
    navn: "Olavs Plass-Strupen",
    fraPost: "Olavs Pl.",
    tilPost: "Strupen",
    beskrivelse: "Trekkrute gjennom tett skog og over liten høyde.",
    retning: "vest",
    terreng: ["skog", "høyde"],
    ekstra: "Brukes ofte tidlig på morgenen."
  },
  {
    navn: "836-Avgang",
    fraPost: "836",
    tilPost: "Avgang",
    beskrivelse: "Elgen trekker fra høydedraget ved 836 og ned mot myra ved Avgang.",
    retning: "sørvest",
    terreng: ["høyde", "myr"],
    ekstra: "Ofte brukt ved vind fra øst."
  },
  {
    navn: "GN Vest-GN Berg",
    fraPost: "GN Vest",
    tilPost: "GN Berg",
    beskrivelse: "Trekkrute over åpen furumo og langs liten bekk.",
    retning: "øst",
    terreng: ["furumo", "bekk"],
    ekstra: "Elgen følger ofte bekken ved regnvær."
  }
];
