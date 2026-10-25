/** RADAR drone aerial mapping — assisted sketch types (not photogrammetry). */

export type DroneLoc = 'pt' | 'es' | 'en';

export type DroneMapBounds =
  | {
      mode: 'center_size';
      lat: number;
      lng: number;
      widthM: number;
      heightM: number;
    }
  | {
      mode: 'corners';
      /** 3–4 corners in order (clockwise or counter-clockwise). */
      corners: Array<{ lat: number; lng: number }>;
    };

export type DroneImageInput = {
  /** Raw base64 without data-URL prefix. */
  base64: string;
  mimeType: string;
  filename?: string;
  /** Optional GPS from client EXIF parse. */
  gps?: { lat: number; lng: number } | null;
};

export type DroneOrganizeHints = {
  plantTypes?: string;
  notes?: string;
  /** Preferred site side in meters when areaHa unknown. */
  siteSideM?: number | null;
  bounds?: DroneMapBounds | null;
};

export type DroneProposedSpace = {
  tempId: string;
  name: string;
  crop: string | null;
  /** Site % coords 0–100. */
  x: number;
  y: number;
  w: number;
  h: number;
  widthM: number | null;
  lengthM: number | null;
  notes: string | null;
  /** If set, reuse this existing unit instead of creating. */
  reuseUnitId?: string | null;
};

export type DroneProposedCrop = {
  name: string;
  variety: string | null;
  season: string | null;
};

export type DroneOrganizeProposal = {
  summary: string;
  confidence: 'low' | 'medium' | 'high';
  siteSideM: number | null;
  spaces: DroneProposedSpace[];
  crops: DroneProposedCrop[];
  limitations: string[];
  visionUsed: boolean;
};

export type DroneAcceptBody = {
  companyId: string;
  engagementId?: string | null;
  propertyId: string;
  proposal: DroneOrganizeProposal;
  /** When true, create units for spaces without reuseUnitId. Default true. */
  createUnits?: boolean;
};
