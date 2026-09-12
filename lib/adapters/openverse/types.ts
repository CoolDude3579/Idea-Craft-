/** Response shapes as verified against GET /v1/images/. */

export interface OpenverseTag {
  readonly name?: string;
  readonly accuracy?: number | null;
  readonly unstable__provider?: string;
}

export interface OpenverseImage {
  readonly id?: string;
  readonly title?: string | null;
  readonly indexed_on?: string | null;
  readonly foreign_landing_url?: string | null;
  readonly url?: string | null;
  readonly thumbnail?: string | null;
  readonly creator?: string | null;
  readonly creator_url?: string | null;
  readonly license?: string | null;
  readonly license_version?: string | null;
  readonly license_url?: string | null;
  readonly provider?: string | null;
  readonly source?: string | null;
  readonly category?: string | null;
  readonly filesize?: number | null;
  readonly filetype?: string | null;
  readonly tags?: readonly OpenverseTag[];
  readonly attribution?: string | null;
  readonly width?: number | null;
  readonly height?: number | null;
}

export interface OpenverseImageList {
  readonly result_count?: number;
  readonly page_count?: number;
  readonly page_size?: number;
  readonly page?: number;
  readonly results?: readonly OpenverseImage[];
}

export interface OpenverseToken {
  readonly access_token?: string;
  readonly expires_in?: number;
  readonly token_type?: string;
}
