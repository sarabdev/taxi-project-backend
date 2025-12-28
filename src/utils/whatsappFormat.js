exports.formatListRow = (place) => {
  const MAX_TITLE = 24;
  const MAX_DESC = 72;

  let title =
    place.name ||
    place.text.split(",")[0]; // fallback

  if (title.length > MAX_TITLE) {
    title = title.slice(0, MAX_TITLE - 1) + "…";
  }

  let description = place.text;
  if (description.length > MAX_DESC) {
    description = description.slice(0, MAX_DESC - 1) + "…";
  }

  return {
    id: place.id, // place_id
    title,
    description,
  };
};
