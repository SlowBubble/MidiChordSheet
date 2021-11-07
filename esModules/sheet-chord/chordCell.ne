
ChordCell -> Splits {% id %}

Splits -> Splits _ Bar _ Chords {% data => {return data.flat().filter(item => item !== null); } %}
        | Chords {% id %}

# Don't use {% id %} for MayBeChord because we want a singleton array.
Chords -> Chords _ MayBeChord {% data => {return data.flat().filter(item => item !== null); } %}
       | MayBeChord

# TODO add more stuff to {type:'Chord'}.
MayBeChord -> Chord {% _ => {return {type:'Chord'}} %}
	| "_" {% _ => {return {type:'Blank'}} %}
	| "-" {% _ => {return {type:'Slot'}} %}

Chord -> Spelling  {% data => {return {type:'Note', solfege: data[1][0], octave: -data[0].length}} %}

Spelling -> [a-gA-G]

Bar -> "|" {% _ => {return {type:'Bar'}} %}
	| ";" {% _ => {return {type:'GuideBar'}} %}
_ -> [ ]:+ {% data => {return null } %}