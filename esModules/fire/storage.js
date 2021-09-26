import * as debug from './debug.js';

function getValues(collectionName, docName) {
  const db = firebase.firestore();
  return db.collection(collectionName).doc(docName).get().then(function (doc) {
      if (doc.exists) return doc.data();
      return null;
  });
}

export async function retrieve(id) {
  const collName = debug.version();
  try {
    const doc = await getValues(collName, id);
    if (doc) {
      return JSON.parse(doc.payload);
    }
  } catch (err) {
    console.warn('Failed to retrieve document.', err);
  }
}

