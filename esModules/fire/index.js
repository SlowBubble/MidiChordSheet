import * as banner from './banner.js';
import * as debug from './debug.js';
import * as signIn from './signIn.js';
import * as mobile from './mobile.js';

const numDocsPerPage = 50;
let firstVisible = null;
let lastVisible = null;

function main() {
  if (mobile.isMobile()) {
    const link = document.querySelector('#new-music-link');
    link.href = 'mobileTrumpet.html';
    link.style.padding = '25px';
  }

  const url = new URL(document.URL);
  const owner = url.searchParams.get('owner');
  loadDocs({owner: owner});

  const nextButton = document.getElementById('next-button');
  nextButton.onclick = _ => {
    loadDocs({startAfter: lastVisible, owner: owner});
  };
  const prevButton = document.getElementById('prev-button');
  prevButton.onclick = _ => {
    loadDocs({endBefore: firstVisible, owner: owner});
  };
  const eBanner = new banner.EphemeralBanner();
  document.body.appendChild(eBanner);
  signIn.setupSignInButton(document, eBanner);
  setupMyStuffLink();
}

async function loadDocs(params) {
  const collName = debug.version();
  const querySnapshot = await getSnapshot(collName, params);
  if (querySnapshot.empty) {
    return;
  }

  // Update pagination info
  firstVisible = querySnapshot.docs[0];
  lastVisible = querySnapshot.docs[querySnapshot.docs.length-1];

  const docs = querySnapshot.docs.map(docSnapshot => {
    return docSnapshot.data();
  });

  const diagramList = document.getElementById('diagram-list');
  while (diagramList.firstChild) {
    diagramList.removeChild(diagramList.firstChild);
  }
  const url = new URL(document.URL);
  docs.forEach(doc => {
    const an = document.createElement("a");
    const songUrl = new URL('/fire/music.html', url.origin);
    songUrl.searchParams.set('view', params.owner ? '0' : '1');
    songUrl.searchParams.set('id', doc.id);
    an.href = songUrl.href;
    an.textContent = doc.title;
    const li = document.createElement("li");
    li.appendChild(an);
    diagramList.appendChild(li);
  });
}

function getSnapshot(collectionName, params) {
  const db = firebase.firestore();
  let query = db.collection(collectionName).orderBy('id', 'desc').limit(numDocsPerPage);
  if (params.owner) {
    query = query.where('owner', '==', params.owner);
  } else {
    query = query.where('hasParts', '==', true)
  }
  if (params.startAfter) {
    query = query.startAfter(params.startAfter);
  } else if (params.endBefore) {
    query = query.endBefore(params.endBefore);
  }
  return query.get().then(function (querySnapshot) {
    return querySnapshot;
  });
}

function setupMyStuffLink() {
  const url = new URL(document.URL);
  const myStuff = document.getElementById('my-stuff');
  const isOwnerPage = !!url.searchParams.get('owner');
  if (isOwnerPage) {
    const homeLink = document.createElement('a');
    homeLink.textContent = 'Home';
    myStuff.appendChild(homeLink);
    const homeUrl = new URL(document.URL);
    homeUrl.searchParams.delete('owner');
    homeLink.href = homeUrl.href;
    return;
  }

  firebase.auth().onAuthStateChanged(function(currUser) {
    if (!currUser) {
      return;
    }
    const myStuffLink = document.createElement('a');
    myStuffLink.textContent = 'My Stuff';
    myStuff.appendChild(myStuffLink);

    const myStuffUrl = new URL(document.URL);
    myStuffUrl.searchParams.set('owner', currUser.email);
    myStuffLink.href = myStuffUrl.href;
  });
}

main();
