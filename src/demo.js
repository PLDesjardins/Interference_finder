const pipe = (id, points, up, down, size, shape = 'CIRCULAR', width = size) => ({ type: 'Feature', geometry: { type: 'LineString', coordinates: points }, properties: { Name: id, US_Invert: up, DS_Invert: down, Geom1: size, SHAPE: shape, Geom2: width } });
export const demo = [
  pipe('STM-101', [[0, 20], [40, 20], [80, 30], [120, 30]], 12.4, 11.2, 0.9),
  pipe('SAN-201', [[25, 0], [25, 60]], 11.6, 10.7, 0.6),
  pipe('STM-102', [[0, 48], [60, 48], [120, 58]], 14.2, 13.2, 1.2, 'RECT_CLOSED', 1.8),
  pipe('SAN-202', [[62, -2], [62, 72]], 10.4, 9.8, 0.75),
  pipe('STM-103', [[98, 0], [98, 75]], 13.0, 11.8, 0.8),
  pipe('SAN-203', [[0, 68], [120, 68]], 10.8, 10.2, 0.6),
];
