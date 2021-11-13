
ChordCell -> Splits {% id %}

Splits -> Splits _ Bar _ Chords {% data => {return data.flat().filter(item => item !== null); } %}
	| Chords {% id %}

# Don't use {% id %} for MayBeChord because we want a singleton array.
Chords -> Chords _ MayBeChord {% data => {return data.flat().filter(item => item !== null); } %}
	| MayBeChord

MayBeChord -> Chord {% id %}
	| "_" {% _ => {return {type:'Blank'}} %}
	| "-" {% _ => {return {type:'Slot'}} %}

Bar -> "|" {% _ => {return {type:'Bar'}} %}
	| ";" {% _ => {return {type:'GuideBar'}} %}

_ -> [ ]:+ {% data => {return null } %}


# Chord grammar
Chord -> BasicChord {% id %}
	| SlashChord {% id %}
	| Polychord {% id %}

Polychord -> BasicChord "|" BasicChord {% data => {
	return {
		type: 'Polychord',
		top: data[0],
		bottom: data[1],
	};
} %}

SlashChord -> BasicChord "/" Spelling {% data => {
	const chord = data[0];
	chord.bass = data[1];
	return chord;
} %}
	
BasicChord -> Spelling Quality:? JazzExtension:? Suspension:? Alteration:* {% data => {return {
	type:'Chord',
	root: data[0],
	quality: data[1],
	extension: data[2],
	suspension: data[3],
	alterations: data[4],
}; } %}

Quality -> "min" {% id %}
	| "aug" {% id %}
	| "dim" {% id %}
	| "o" {% _ => 'dim' %}
	| "ø" {% _ => 'half_dim' %}
	| "+" {% _ => 'aug' %}
	| "-" {% _ => 'min' %}
	| "m" {% _ => 'min' %}

Alteration -> AlterQuantity AlterationNum {% data => {return {
	extensionNum: parseInt(data[1]),
	numSharps: data[0],
}; }%}

AlterationNum -> "5" {% id %}
	| "9" {% id %}
	| "11" {% id %}
	| "13" {% id %}

JazzExtension -> Major:? JazzExtNum {% data => {return {isMajor7: data[0] != null, extensionNum: parseInt(data[1])}; } %}

JazzExtNum -> "6" {% id %}
	| "7" {% id %}
	| "9" {% id %}
	| "11" {% id %}
	| "13" {% id %}

Suspension -> "sus" [24]:? {% data => parseInt(data[1] || "4") %}

Major -> "maj" {% id %}
	| "M" {% _ => 'maj' %}
	| "∆" {% _ => 'maj' %}

Spelling -> Letter Accidental:* {% data => {return {root: data[0], numSharps: data[1].reduce((a, b) => a + b, 0)}} %}

Letter -> [a-gA-G] {% data => {return data[0].toUpperCase()} %}

Accidental -> "#" {% data => {return 1} %}
	| "b" {% data => {return -1} %}
	
AlterQuantity -> Accidental {% id %}
	| "," {% data => {return 0} %}
	| "/" {% data => {return 0} %}
	| "add" {% data => {return 0} %}

