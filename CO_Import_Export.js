var COIE_Loaded = false;
var script_version = 0.1;

function sendPlayer(origin, msg) {
	var dest = origin;
	if (origin.who) {
		if (playerIsGM(origin.playerid)) dest = 'GM';
		else dest = origin.who;
	}
	sendChat('COIE', '/w "' + dest + '" ' + msg);
}

function export_character(msg) {
	var json_export = [];

	if (msg.selected !== undefined) {
		var all_characters = [];
		_.each(msg.selected, function(selection) {
			var token = getObj("graphic", selection._id);
			var character = getObj('character', token.get('represents'));

			if (character !== undefined) {
				all_characters.push(character);
			}
		});

		var cpt = 0;

		_.each(all_characters, function(character) {
			var charId = character.get('_id')
			var character_name = character.get('name');
			var export_character = {};

			export_character.character = {
				name: character_name,
				avatar: character.get('avatar'),
				notes: '',
				gmnotes: '',
				bio: '',
			};

			character.get("notes", function(notes) { // asynchronous
				if (notes.length > 0 && notes != 'null') export_character.character.notes = notes.replace(/<br>/g, '\n');

				character.get("gmnotes", function(gmnotes) { // asynchronous
					if (gmnotes.length > 0 && gmnotes != 'null') export_character.character.gmnotes = gmnotes.replace(/<br>/g, '\n');

					character.get("bio", function(bio) { // asynchronous
						if (bio.length > 0 && bio != 'null') export_character.character.bio = bio.replace(/<br>/g, '\n');

						var attributes = findObjs({
							_type: 'attribute',
							_characterid: charId,
						});
						export_character.attributes = [];
						_.each(attributes, function(attribute, i) {
							export_character.attributes.push({
								name: attribute.get('name'),
								current: attribute.get('current'),
								max: attribute.get('max')
							});
						});
						var abilities = findObjs({
							_type: 'ability',
							_characterid: charId,
						});
						export_character.abilities = [];
						_.each(abilities, function(ability, i) {
							export_character.abilities.push({
								name: ability.get('name'),
								description: ability.get('description'),
								action: ability.get('action'),
								istokenaction: ability.get('istokenaction')
							});
						});

						json_export.push(export_character);
						sendChat('COIE', '/w gm Export ' + character_name + ' effectué.');

						cpt++;
						if (cpt == all_characters.length) {
							// Génère une erreur :
							// "ERROR: You cannot set the imgsrc or avatar of an object unless you use an image that is in your Roll20 Library. See the API documentation for more info."
							// => c'est "normal" : https://app.roll20.net/forum/post/2405159/api-create-handout-error/?pageforid=2405587
							var this_handout = createObj("handout", {
								name: 'COExport_' + msg.date
							});

							this_handout.set('notes', JSON.stringify(json_export));
							sendChat('COIE', '/w gm Export terminé.');
						}

					});
				});
			});
		});
	}
}

function parse_charac(MOD, line) {
	var characteristic = 0;

	line = line.split(MOD + ' ');
	if (line[1] !== undefined) {
		var value = line[1].trim();
		if (value.indexOf(' ')) value = value.split(' ')[0];
		if (value.indexOf('+') !== -1) value = value.split('+')[1];
		characteristic = value.trim();
	}

	return parseInt(characteristic);
}

function get_valeur(Mod, line) {
	return parseInt(10 + 2 * Mod);
}

function import_character() {
	var import_handouts = findObjs({
		_type: 'handout',
		name: 'COImport',
	});

	import_handouts.forEach(function(import_handout, i) {
		import_handout.get('notes', function(notes) { // asynchronous
			try {
				var all_characters = JSON.parse(notes.replace(/<br>/g, '').trim());

				_.each(all_characters, function(character_data) {
					var character = character_data.character;
					var new_character = createObj("character", {
						name: character.name,
						avatar: character.avatar
					});
					new_character.set('notes', character.notes.replace(/\n/g, '<br>'));
					new_character.set('gmnotes', character.gmnotes.replace(/\n/g, '<br>'));
					new_character.set('bio', character.bio.replace(/\n/g, '<br>'));

					var charId = new_character.get('id');

					var attributes = character_data.attributes;
					_.each(attributes, function(attribute, i) {
						var new_attribute = createObj("attribute", {
							_characterid: charId,
							name: attribute.name,
							current: attribute.current,
							max: attribute.max
						});
					});

					var abilities = character_data.abilities;
					_.each(abilities, function(ability, i) {
						var new_ability = createObj("ability", {
							_characterid: charId,
							name: ability.name,
							description: ability.description,
							action: ability.action,
							istokenaction: ability.istokenaction
						});
					});

					sendChat('COIE', '/w gm Import ' + character.name + ' effectué.');
				});
			} catch (e) {
				if (notes.indexOf('FOR ') !== -1 && notes.indexOf('DEX ') !== -1 && notes.indexOf('CON ') !== -1 && notes.indexOf('INT ') !== -1 && notes.indexOf('SAG') !== -1 && notes.indexOf('CHA ') !== -1 && notes.indexOf('DEF ') !== -1 && notes.indexOf('PV ') !== -1 && notes.indexOf('Init ') !== -1) {
					notes = notes.trim().split('<br>');
					var new_character, character = {},
						charId, attributes = [],
						FOR_MOD = 0,
						DEX = 0,
						DEX_MOD = 2,
						INIT = 0,
						cpt = 0,
						attack_contact = 0,
						attack_distance = 0,
						tmp, NIVEAU;
					_.each(notes, function(line, i) {
						if (i == 0) {
							character.name = line.trim();
              if (character.name.indexOf('(') !== -1) character.name = character.name.split('(')[0];
							new_character = createObj("character", {
								name: character.name,
							});

							charId = new_character.get('id');
						} else {
							if (line.indexOf('NC ') !== -1) {
								NIVEAU = parseInt(line.split('NC ')[1].replace(/[^0-9\.]/g, ''), 10);
								if (!NIVEAU || NIVEAU < 1) NIVEAU = 1;

								attributes.push({
									name: 'NIVEAU',
									current: NIVEAU,
									max: ''
								});
							}
							if (line.indexOf('FOR ') !== -1) {
								FOR_MOD = parse_charac('FOR', line);
								attributes.push({
									name: 'FORCE',
									current: get_valeur(FOR_MOD),
									max: ''
								});
							}
							if (line.indexOf('DEX ') !== -1) {
								DEX_MOD = parse_charac('DEX', line);
								DEX = get_valeur(DEX_MOD);
							}
							if (line.indexOf('CON ') !== -1) {
								attributes.push({
									name: 'CONSTITUTION',
									current: get_valeur(parse_charac('CON', line)),
									max: ''
								});
							}
							if (line.indexOf('INT ') !== -1) {
								attributes.push({
									name: 'INTELLIGENCE',
									current: get_valeur(parse_charac('INT', line)),
									max: ''
								});
							}
							if (line.indexOf('SAG ') !== -1) {
								attributes.push({
									name: 'SAGESSE',
									current: get_valeur(parse_charac('SAG', line)),
									max: ''
								});
							}
							if (line.indexOf('CHA ') !== -1) {
								attributes.push({
									name: 'CHARISME',
									current: get_valeur(parse_charac('CHA', line)),
									max: ''
								});
							}
							if (line.indexOf('DEF ') !== -1) {
								attributes.push({
									name: 'DEFDIV',
									current: parse_charac('DEF', line) - 10 - DEX_MOD,
									max: ''
								});
							}
							if (line.indexOf('PV ') !== -1) {
								attributes.push({
									name: 'PV',
									current: parse_charac('PV', line),
									max: parse_charac('PV', line)
								});
							}
							if (line.indexOf('(RD ') !== -1) {
								attributes.push({
									name: 'RDS',
									current: parse_charac('(RD', line),
									max: ''
								});
							}
							if (line.indexOf('Init ') !== -1) {
								INIT = parse_charac('Init', line);

								if (Math.floor((DEX - 10) / 2) == Math.floor((INIT - 10) / 2)) {
									attributes.push({
										name: 'DEXTERITE',
										current: INIT,
										max: ''
									});
								} else {
									attributes.push({
										name: 'DEXTERITE',
										current: DEX,
										max: ''
									});

									attributes.push({
										name: 'INIT_DIV',
										current: INIT - DEX,
										max: ''
									});
								}
							}

							if (line.indexOf(' DM ') !== -1) {
								cpt++;

								attack_contact = NIVEAU + FOR_MOD;
								attack_distance = NIVEAU + DEX_MOD;

								var armenom = '',
									armeatk = '@{ATKCAC}',
									armeatkdiv = '',
									armedmcar = '@{FOR}',
									armedmnbde = 1,
									armedmde = 4,
									armedmdiv = '',
									armeportee = 0;

								// ici, virer le +
								armenom = line.split(' DM ')[0].trim();
								tmp = armenom.split(' ');
								tmp = tmp[tmp.length - 1];
								if (tmp.indexOf('+') !== -1) {
									tmp = tmp.split('+');
									armeatkdiv = parseInt(tmp[1].replace(/[^0-9\.]/g, ''), 10);
								} else if (tmp.indexOf('-') !== -1) {
									tmp = tmp.split('-');
									armeatkdiv = -parseInt(tmp[1].replace(/[^0-9\.]/g, ''), 10);
								}

								armenom = armenom.split('+')[0].trim();

								if (armenom.indexOf('m)') !== -1) {
									tmp = armenom.split('m)');
									log(tmp);
									armenom = armenom.split('(')[0];
									tmp = tmp[0].trim().split(' ');
									log(tmp);
									tmp = tmp[tmp.length - 1].split('(');
									log(tmp);
									armeportee = parseInt(tmp[1].trim().replace(/[^0-9\.]/g, ''), 10);
									log(armeportee);
								}

								armenom = armenom.trim();

								if (armeportee > 0) {
									armeatk = '@{ATKTIR}';
									armedmcar = '0';
								}

								var dommage = line.split(' DM ')[1].trim();
								if (dommage.indexOf('d') !== -1) {
									armedmnbde = parseInt(dommage.split('d')[0].trim().replace(/[^0-9\.]/g, ''), 10);
									armedmde = dommage.split('d')[1].trim();
									if (armedmde.indexOf('+') !== -1) {
										tmp = armedmde.split('+');
										armedmde = tmp[0].trim();
										armedmdiv = tmp[1].trim()
									} else if (armedmde.indexOf('-') !== -1) {
										tmp = armedmde.split('-');
										armedmde = tmp[0].trim();
										armedmdiv = -tmp[1].trim()
									}
								}

								armeatkdiv = parseInt(armeatkdiv + ''.replace(/[^0-9\.]/g, ''), 10);
								armedmdiv = parseInt(armedmdiv + ''.replace(/[^0-9\.]/g, ''), 10);

								if (armeportee == 0) {
									armeatkdiv = armeatkdiv - attack_contact;
									armedmdiv = armedmdiv - FOR_MOD;
								} else {
									armeatkdiv = armeatkdiv - attack_distance;
								}

								if (!armeatkdiv) armeatkdiv = '';
								if (!armedmdiv) armedmdiv = '';

								var bonus_degat = line.split(' DM ')[0].split(' ');
								bonus_degat = bonus_degat[bonus_degat.length - 1];
								if (bonus_degat.indexOf('+') !== -1) bonus_degat = bonus_degat.replace('+', '');

								attributes.push({
									name: 'repeating_armes_' + i + '_' + 'armenom',
									current: armenom,
									max: ''
								});
								attributes.push({
									name: 'repeating_armes_' + i + '_' + 'armeatk',
									current: armeatk,
									max: ''
								});
								attributes.push({
									name: 'repeating_armes_' + i + '_' + 'armeatkdiv',
									current: armeatkdiv,
									max: ''
								});
								attributes.push({
									name: 'repeating_armes_' + i + '_' + 'armedmcar',
									current: armedmcar,
									max: ''
								});
								attributes.push({
									name: 'repeating_armes_' + i + '_' + 'armedmnbde',
									current: armedmnbde,
									max: ''
								});
								attributes.push({
									name: 'repeating_armes_' + i + '_' + 'armedmde',
									current: armedmde,
									max: ''
								});
								attributes.push({
									name: 'repeating_armes_' + i + '_' + 'armedmdiv',
									current: armedmdiv,
									max: ''
								});
								attributes.push({
									name: 'repeating_armes_' + i + '_' + 'armeportee',
									current: armeportee,
									max: ''
								});
							}
						}
					});

					//log(attributes);
					_.each(attributes, function(attribute, i) {
						var new_attribute = createObj("attribute", {
							_characterid: charId,
							name: attribute.name,
							current: attribute.current,
							max: attribute.max
						});
					});

					sendChat('COIE', '/w gm Import ' + character.name + ' effectué.');
				} else sendChat('COIE', '/w gm Import impossible. Le contenu du handout COImport semble incorrect...');
			}
		});
	});
}

function check_command(msg) {
	msg.content = msg.content.replace(/\s+/g, ' '); //remove duplicate whites
	var command = msg.content.split(" ", 1);

	switch (command[0]) {
		case "!co-export":
			export_character(msg);
			return;
		case "!co-import":
			import_character();
			return;
		default:
			return;
	}
}

on("ready", function() {
	COIE_Loaded = true;
	log("CO Import/Export version " + script_version + " loaded.");
});

on("chat:message", function(msg) {
	"use strict";
	if (!COIE_Loaded || msg.type != "api") return;
	msg.date = (new Date()).toISOString().split('.')[0].replace('T', '_');
	check_command(msg);
});

on("change:handout", function(obj) {
	if (obj.get('name') == "COImport") import_character();
});