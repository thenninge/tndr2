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
