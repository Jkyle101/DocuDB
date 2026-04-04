export const updateCopcSearchParams = (
  searchParams,
  setSearchParams,
  updates = {},
  options = {}
) => {
  const currentParams = new URLSearchParams(searchParams);
  const nextParams = new URLSearchParams(currentParams);

  Object.entries(updates || {}).forEach(([key, value]) => {
    if (value === null || value === undefined || value === "") {
      nextParams.delete(key);
      return;
    }
    nextParams.set(key, String(value));
  });

  if (nextParams.toString() === currentParams.toString()) return false;

  setSearchParams(nextParams, { replace: options.replace !== false });
  return true;
};
