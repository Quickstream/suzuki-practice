// Built-in Suzuki Violin School repertoire (Books 1–10), in teaching order.
//
// Durations are approximate playing times in seconds at a comfortable
// student tempo, with repeats. Families can override any duration (and add,
// hide or reorder songs) from the Songs tab, so these are just a starting point.
//
// Titles follow the revised (Alfred / International) editions as closely as
// possible. Older printings differ slightly in a few books, so check this
// list against your children's books and edit it in the app as needed.
(function (root) {
  'use strict';

  // [title, composer, approxSeconds]
  var BOOKS = {
    1: [
      ['Twinkle Variation A', 'S. Suzuki', 40],
      ['Twinkle Variation B', 'S. Suzuki', 40],
      ['Twinkle Variation C', 'S. Suzuki', 40],
      ['Twinkle Variation D', 'S. Suzuki', 40],
      ['Twinkle Theme', 'S. Suzuki', 40],
      ['Lightly Row', 'Folk Song', 35],
      ['Song of the Wind', 'Folk Song', 30],
      ['Go Tell Aunt Rhody', 'Folk Song', 45],
      ['O Come, Little Children', 'Folk Song', 30],
      ['May Song', 'Folk Song', 35],
      ['Long, Long Ago', 'T. H. Bayly', 45],
      ['Allegro', 'S. Suzuki', 45],
      ['Perpetual Motion', 'S. Suzuki', 60],
      ['Allegretto', 'S. Suzuki', 40],
      ['Andantino', 'S. Suzuki', 45],
      ['Etude', 'S. Suzuki', 60],
      ['Minuet 1', 'J. S. Bach', 60],
      ['Minuet 2', 'J. S. Bach', 60],
      ['Minuet 3', 'J. S. Bach', 75],
      ['The Happy Farmer', 'R. Schumann', 50],
      ['Gavotte', 'F. J. Gossec', 120]
    ],
    2: [
      ['Chorus from "Judas Maccabaeus"', 'G. F. Handel', 75],
      ['Musette', 'J. S. Bach', 90],
      ['Hunters\' Chorus', 'C. M. von Weber', 80],
      ['Long, Long Ago (with Variation)', 'T. H. Bayly', 105],
      ['Waltz', 'J. Brahms', 75],
      ['Bourrée', 'G. F. Handel', 75],
      ['The Two Grenadiers', 'R. Schumann', 150],
      ['Theme from "Witches\' Dance"', 'N. Paganini', 165],
      ['Gavotte from "Mignon"', 'A. Thomas', 150],
      ['Gavotte', 'J. B. Lully', 150],
      ['Minuet in G', 'L. van Beethoven', 135],
      ['Minuet', 'L. Boccherini', 180]
    ],
    3: [
      ['Gavotte', 'P. Martini', 120],
      ['Minuet', 'J. S. Bach', 120],
      ['Gavotte in G Minor', 'J. S. Bach', 135],
      ['Humoresque', 'A. Dvořák', 165],
      ['Gavotte', 'J. Becker', 150],
      ['Gavotte in D Major', 'J. S. Bach', 180],
      ['Bourrée', 'J. S. Bach', 150]
    ],
    4: [
      ['Concerto No. 2, 3rd Mvt.', 'F. Seitz', 210],
      ['Concerto No. 5, 3rd Mvt.', 'F. Seitz', 195],
      ['Concerto No. 5, 1st Mvt.', 'F. Seitz', 240],
      ['Concerto in A Minor, 1st Mvt.', 'A. Vivaldi', 210],
      ['Concerto in A Minor, 3rd Mvt.', 'A. Vivaldi', 180],
      ['Concerto for Two Violins, 1st Mvt. (Violin II)', 'J. S. Bach', 240]
    ],
    5: [
      ['Gavotte', 'J. S. Bach', 180],
      ['Concerto in A Minor, 2nd Mvt.', 'A. Vivaldi', 150],
      ['Concerto in G Minor, 1st Mvt.', 'A. Vivaldi', 180],
      ['Concerto in G Minor, 2nd Mvt.', 'A. Vivaldi', 120],
      ['Country Dance', 'C. M. von Weber', 90],
      ['German Dance', 'K. Ditters von Dittersdorf', 120],
      ['Gigue', 'F. M. Veracini', 165],
      ['Concerto for Two Violins, 1st Mvt. (Violin I)', 'J. S. Bach', 240]
    ],
    6: [
      ['La Folia', 'A. Corelli / S. Suzuki', 300],
      ['Sonata No. 3 in F Major, 1st Mvt.', 'G. F. Handel', 150],
      ['Sonata No. 3 in F Major, 2nd Mvt.', 'G. F. Handel', 150],
      ['Sonata No. 3 in F Major, 3rd Mvt.', 'G. F. Handel', 90],
      ['Sonata No. 3 in F Major, 4th Mvt.', 'G. F. Handel', 150],
      ['Allegro', 'J. H. Fiocco', 180],
      ['Gavotte', 'J. P. Rameau', 180],
      ['Sonata No. 4 in D Major, 1st Mvt.', 'G. F. Handel', 180],
      ['Sonata No. 4 in D Major, 2nd Mvt.', 'G. F. Handel', 180]
    ],
    7: [
      ['Minuet', 'W. A. Mozart', 150],
      ['Courante', 'A. Corelli', 150],
      ['Sonata No. 1 in A Major, 1st Mvt.', 'G. F. Handel', 150],
      ['Sonata No. 1 in A Major, 2nd Mvt.', 'G. F. Handel', 150],
      ['Sonata No. 1 in A Major, 3rd Mvt.', 'G. F. Handel', 90],
      ['Sonata No. 1 in A Major, 4th Mvt.', 'G. F. Handel', 150],
      ['Concerto in A Minor, 1st Mvt.', 'J. S. Bach', 240],
      ['Gigue', 'J. S. Bach', 150],
      ['Courante', 'J. S. Bach', 180],
      ['Allegro', 'A. Corelli', 150]
    ],
    8: [
      ['Sonata in G Minor, 1st Mvt.', 'H. Eccles', 150],
      ['Sonata in G Minor, 2nd Mvt.', 'H. Eccles', 120],
      ['Tambourin', 'A. E. M. Grétry', 120],
      ['Largo (Sonata No. 3 in C Major)', 'J. S. Bach', 210],
      ['Allegro (Sonata in E Minor)', 'J. S. Bach', 180],
      ['Largo Espressivo', 'G. Pugnani', 210],
      ['Sonata in E Minor', 'F. M. Veracini', 300]
    ],
    9: [
      ['Concerto No. 5 in A Major, K. 219, 1st Mvt.', 'W. A. Mozart', 600]
    ],
    10: [
      ['Concerto No. 4 in D Major, K. 218, 1st Mvt.', 'W. A. Mozart', 540]
    ]
  };

  var SONGS = [];
  Object.keys(BOOKS).forEach(function (book) {
    BOOKS[book].forEach(function (s, i) {
      var num = i + 1;
      SONGS.push({
        id: 'b' + book + '-' + (num < 10 ? '0' : '') + num,
        book: Number(book),
        num: num,
        title: s[0],
        composer: s[1],
        seconds: s[2],
        builtIn: true
      });
    });
  });

  var api = { SUZUKI_SONGS: SONGS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.SuzukiSongs = api;
})(this);
