export const PDF_FILE = "/ebook.pdf";

// Chapters (all keep the same video)
export const CHAPTERS = [
  { title: "The Night We Met", startPage: 1, video: "/video/intro.mp4" }, //TNWM
  {
    title: "When Our Threads First Touched",
    startPage: 2,
    video: "/video/intro.mp4",
  }, //TNWM
  {
    title: "The Glance Across a Dance Floor",
    startPage: 4,
    video: "/video/iraaday.mp4",
  }, //iradaay
  { title: "Two Minutes From Home", startPage: 6, video: "/video/iraaday.mp4" }, //iraaday
  {
    title: "Before the Bell Rang for the Last Time",
    startPage: 8,
    video: "/video/nightchanges.mp4",
  }, //night changes
  {
    title: "Between Passion and Goodbye",
    startPage: 10,
    video: "/video/nightchanges.mp4",
  }, //night changes
  { title: "Aftermath & Altitude", startPage: 12, video: "/video/nadaan.mp4" }, //nadaan parinde
  {
    title: "When the Thread Found Its Way Back",
    startPage: 14,
    video: "/video/jiyenkyun.mp4",
  }, //jiyen kyun
  {
    title: "The Choice Within the Chaos",
    startPage: 16,
    video: "/video/jiyenkyun.mp4",
  }, //jiyen kyun
  {
    title: "The Night We Met Again",
    startPage: 18,
    video: "/video/jiyenkyun.mp4",
  }, //jiyen kyun
  {
    title: "Our First Trip Together",
    startPage: 20,
    video: "/video/humraah.mp4",
  }, //kabhi kabhi aditi
  { title: "11th February", startPage: 22, video: "/video/thoseeyes.mp4" }, //those eyes
  {
    title: "All Roads Led to This",
    startPage: 24,
    video: "/video/thoseeyes.mp4",
  }, //those eyes
  {
    title: "The Week the World Disappeared",
    startPage: 27,
    video: "/video/thoseeyes.mp4",
  }, //those eyes
  { title: "My Love", startPage: 30, video: "/video/jhol.mp4" }, //jhol
  { title: "Back Cover", startPage: 33, video: "/video/jhol.mp4" },
];

// Switch video when entering a new chapter (it won’t change since all are the same)
export const AUTO_SWITCH_VIDEO_ON_CHAPTER_CHANGE = true;

// Initial volume [0..1]
export const INITIAL_VOLUME = 0.6;
