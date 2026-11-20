// Mentor sign-up uses the site's one contact form (formType "inquiry"), not a
// separate form (Curiosity-Corp/ignite-curiosity#23). Links such as
// contact.html?topic=mentor-robotics prefill the subject so the message arrives
// labelled. Only the topics below are accepted; anything else leaves the form as is.
(function () {
  'use strict';
  var TOPICS = {
    'mentor-robotics': {
      subject: 'Mentor sign-up: Robotics club',
      prompt: 'Tell us what you can help with: building, programming, safety, or running a challenge.'
    },
    'mentor-biotechnology': {
      subject: 'Mentor sign-up: Biodesign challenge',
      prompt: 'Tell us what you can help with: biology, data, safety and ethics, or presenting.'
    }
  };
  var topic;
  try {
    topic = new URLSearchParams(window.location.search).get('topic');
  } catch (err) {
    console.warn('contact-topic: cannot read the topic from the address', err);
    return;
  }
  if (!topic || !Object.prototype.hasOwnProperty.call(TOPICS, topic)) return;
  var subject = document.getElementById('p_subject');
  var message = document.getElementById('p_message');
  if (!subject) {
    console.warn('contact-topic: the contact form has no subject field (#p_subject)');
    return;
  }
  if (!subject.value) subject.value = TOPICS[topic].subject;
  if (message && !message.value) message.placeholder = TOPICS[topic].prompt;
})();
