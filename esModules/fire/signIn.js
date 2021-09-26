

export function setupHomeLink(htmlNode) {
  const url = new URL(document.URL);
  firebase.auth().onAuthStateChanged(user => {
    if (!user) {
      return;
    }
    const homeUrl = new URL('/fire/', url.origin);
    homeUrl.searchParams.set('owner', user.email);
    htmlNode.querySelector('#home-link').href = homeUrl.href;
  });
}

export function setupHomeButton(htmlNode) {
  const url = new URL(document.URL);
  firebase.auth().onAuthStateChanged(user => {
    if (!user) {
      return;
    }
    const homeUrl = new URL('/fire/', url.origin);
    homeUrl.searchParams.set('owner', user.email);
    htmlNode.querySelector('#home-control').onclick = _ => {
      window.location.href = homeUrl.href;
    };
  });
}

export function setupSignInButton(htmlNode, eBanner) {
  firebase.auth().onAuthStateChanged(user => {
    if (!user) {
      eBanner.display('Not signed in.');
      htmlNode.querySelector('#sign-in-button').textContent = 'Google Sign In';
      return;
    }
    htmlNode.querySelector('#sign-in-button').textContent = 'Sign Out';
  });
  htmlNode.querySelector('#sign-in-button').onclick = evt => {
    if (firebase.auth().currentUser) {
      firebase.auth().signOut().catch(error => {
        console.warn("Sign in error", error);
        eBanner.slowDisplay(error.message);
      });
      return;
    }
    const provider = new firebase.auth.GoogleAuthProvider();
    firebase.auth().signInWithPopup(provider).then(result => {
      console.log('Sign in result', result);
    }).catch(error => {
      console.warn("Sign in error", error);
      eBanner.slowDisplay(error.message);
    });
  };
}