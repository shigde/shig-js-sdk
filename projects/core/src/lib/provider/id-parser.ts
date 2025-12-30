const UUID_REGEX =
  /[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[1-5][0-9a-fA-F]{3}-[89abAB][0-9a-fA-F]{3}-[0-9a-fA-F]{12}/;

export function extractPeerId(trackId: string): string {
  const match = trackId.match(UUID_REGEX);
  return match ? match[0] : trackId;
}
