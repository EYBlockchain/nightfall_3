// ignore unused exports

export const parseData = function (reader) {
  const arr = [];
  return reader.read().then(function processData(result) {
    if (result.done) {
      // do stuff when `reader` is `closed`
      return reader.closed.then(function () {
        // return `json` string
        return arr;
      });
    }
    arr.push(result.value);
    return reader.read().then(processData);
  });
};

export const mergeUint8Array = function (array) {
  let length = 0;
  array.forEach(item => {
    length += item.length;
  });
  // Create a new array with total length and merge all source arrays.
  const mergedArray = new Uint8Array(length);
  let offset = 0;
  array.forEach(item => {
    mergedArray.set(item, offset);
    offset += item.length;
  });
  return mergedArray;
};
