const Marker = require('../../database/models/index').Marker;
const MarkerDescription = require('../../database/models/index').MarkerDescription;
const MarkerPicture = require('../../database/models/index').MarkerPicture;
const ToNote = require('../../database/models/index').ToNote;
const Note = require('../../database/models/index').Note;
const passport = require('../lib/AuthStrategy');
const Sequelize = require('../../database/models/index').Sequelize;

const {BadRequest, NotFound} = require('../errors');

const express = require('express');

const marker = express.Router();

// marker.use(passport.auth());

marker.get('/', (req, res) => {
  Marker.findOne({ where: { id: res.id }, include: [
    { all: true, include: [
      { model: MarkerPicture, as: 'pictures'}
    ]}
  ]}).then(tasks => {
    if(tasks) {
      res.json(tasks);
    } else {
      res.json(new NotFound('ID doesn\'t exist'));
    }
  });
});

marker.get('/description', (req, res) => {
  // console.log(res, req._passport, req.session, req.user);
  let include = [ { attributes: [ 'picture' ], model: MarkerPicture, as: 'pictures' }];
  if(req.params.user_id) {
    include.push({ attributes: [ 'note' ], model: Note, through: { attributes: [] }, as: 'user_note', where: { user_id: +res.params.user_id }}); // limit: 1
  }

  MarkerDescription.findOne({
    attributes: Object.keys(MarkerDescription.attributes).concat([
      [Sequelize.literal('(SELECT ROUND(AVG(`Note`.`note`), 2) FROM `to_note` LEFT JOIN `note` ON `to_note`.`note_id` = `note`.`id` WHERE `marker_description_id` = ' + res.id + ')'), 'note']
    ]),
    where: { marker_id: res.id },
    include: include
  }).then(tasks => {
    if(tasks) {
      let json = tasks.toJSON();
      json.note = parseFloat(json.note);// CAST(AS FLOAT) IN SQL doesn't work
      if(json.user_note) {
        json.user_note = json.user_note[0].note;
      } // I don't know how to fix that with sequelize
      json.pictures = json.pictures.map((p) => p.picture);
      res.json(json);
    } else {
      res.json(new NotFound('ID doesn\'t exist'));
    }
  });
});

marker.post('/note', (req, res) => {
  const tempSQL = 'SELECT id from NOTE WHERE type=\'' + req.body.type + '\' AND note=' + req.body.note;

  ToNote
    .update(
      { note_id: Sequelize.literal('(' + tempSQL + ')')},
      {
        where: {
          marker_description_id: res.id,
          user_id: req.body.user_id
        }
      }
    ).then(result =>
      res.json({ note: req.body.note })
    )
    .catch(err =>
      ToNote.create({
        marker_description_id: res.id,
        user_id: req.body.user_id,
        note_id: Sequelize.literal('(' + tempSQL + ')')
      }).then(result => {
        res.json({ note: req.body.note });
      }).catch(error => {
        res.json(new BadRequest());
      })
    );
});


module.exports = marker;
