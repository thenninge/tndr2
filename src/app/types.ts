export type Elgpost = {
  nr: number;
  lat: number;
  lng: number;
  name: string;
  omrade: string;
};

export type Fall = {
  dato: string; // ISO string eller dd/mm-yyyy
  lat: number;
  lng: number;
  type: string; // f.eks. Okse, Ku, Kalv
  vekt: number; // kg
  skytter: string; // navn eller callsign
};

export type FallObs = {
  dato: string; // ISO string eller dd/mm-yyyy
  lat: number;
  lng: number;
  type: string; // f.eks. Okse, Ku, Kalv, Ku+kalv, ungdyr, ukjent
  retning: string; // f.eks. nord, vest, nordvest, ukjent
  antall: number;
  kategori: 'fall' | 'obs';
  person?: string; // skytter/observatør, valgfri
};

export type Trekkrute = {
  navn: string; // f.eks. "Røytjern-Avgang"
  fraPost: string; // postnavn
  tilPost: string; // postnavn
  beskrivelse: string; // f.eks. "Går over myrdraget nord for Avgang"
  retning: string; // f.eks. "nordvest"
  terreng: string[]; // f.eks. ["myr", "høyde", "elv"]
  ekstra?: string; // valgfri fritekst
};
