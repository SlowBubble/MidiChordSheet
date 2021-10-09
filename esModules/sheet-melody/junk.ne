# so mi | ti, => [
#  {type: "Note", solfege: "so", octave: 0},
#  {type: "Note", solfege: "mi", octave: 0},
#  {type: "Bar", level: 0},
#  {type: "Note", solfege: "ti", octave: -1}]
MelodicCell -> Splits {% id %}

Splits -> Splits _ Bar _ Notes {% data => {return data.flat().filter(item => item !== null); } %}
        | Notes {% id %}

Notes -> Notes _ Note {% data => {return data.flat().filter(item => item !== null); } %}
       | Note {% id %}

# Note that because Solfege does not do post-processing using {% id %},
# data[0] is an singleton array, e.g. ["daw"].
# data[1] is an singleton array, e.g. [",", ","].
Note -> Solfege [']:* {% data => {return {type:'Note', solfege: data[0][0], octave: data[1].length}} %}
	| Solfege [,]:+ {% data => {return {type:'Note', solfege: data[0][0], octave: -data[1].length}} %}
	| "_" {% _ => {return {type:'Blank'}} %}
	| "-" {% _ => {return {type:'Slot'}} %}
	| "x" {% _ => {return {type:'Rest'}} %}

Solfege -> "daw"
	| "de"
	| "do"
	| "di"
	| "raw"
	| "ra"
	| "re"
	| "ri"
	| "rai"
	| "maw"
	| "me"
	| "mi"
	| "mai"
	| "faw"
	| "fe"
	| "fa"
	| "fi"
	| "fai"
	| "saw"
	| "se"
	| "so"
	| "si"
	| "sai"
	| "law"
	| "le"
	| "la"
	| "li"
	| "lai"
	| "taw"
	| "te"
	| "ti"
	| "tai"

Bar -> "|" [']:* {% ([bar, quotes]) => {return {type:'Bar', level: quotes.length}} %}

_ -> [ ]:+ {% data => {return null } %}
