# so mi | ti, => [
#  {type: "Note", solfege: "so", octave: 0},
#  {type: "Note", solfege: "mi", octave: 0},
#  {type: "Bar", level: 0},
#  {type: "Note", solfege: "ti", octave: -1}]
MelodicCell -> Splits {% id %}

Splits -> Splits __ Bar __ Notes {% data => {return data.flat().filter(item => item !== null); } %}
        | Notes {% id %}

# Don't use {% id %} for Note because we want a singleton array.
Notes -> Notes _ Note {% data => {return data.flat().filter(item => item !== null); } %}
       | Note
	   | null {% data => {return [{type:'Blank'}] } %}

# Note that because Solfege does not do post-processing using {% id %},
# data[0] is an array, e.g. ["/", "/"].
# data[1] is a singleton array, e.g. ["daw"].
Note -> [/]:* Solfege  {% data => {return {type:'Note', solfege: data[1][0], octave: -data[0].length}} %}
	| [\\]:+ Solfege  {% data => {return {type:'Note', solfege: data[1][0], octave: data[0].length}} %}
	| [/]:* ScaleDegree  {% data => {return {type:'Note', scaleDegree: data[1], octave: -data[0].length}} %}
	| [\\]:+ ScaleDegree  {% data => {return {type:'Note', scaleDegree: data[1], octave: data[0].length}} %}
	| [/]:* Spelling  {% data => {return {type:'Note', spelling: data[1], octave: -data[0].length}} %}
	| [\\]:+ Spelling  {% data => {return {type:'Note', spelling: data[1], octave: data[0].length}} %}
	| "_" {% _ => {return {type:'Blank'}} %}
	| "-" {% _ => {return {type:'Slot'}} %}
	| "x" {% _ => {return {type:'Rest'}} %}


scaleNumber -> [1-7] {% data => { return parseInt(data[0]); } %}
ScaleDegree -> [b]:* scaleNumber {% data => {return {numSharps: -data[0].length, scaleNumber: data[1]}} %}
  | [#]:+ scaleNumber {% data => {return {numSharps: data[0].length, scaleNumber: data[1]}} %}

Spelling -> Letter [b]:* {% data => {return {letter: data[0], numSharps: -data[1].length}} %}
  | Letter [#]:+ {% data => {return {letter: data[0], numSharps: data[1].length}} %}

Letter -> [a-gA-G] {% data => {return data[0].toUpperCase() } %}

Solfege -> "da"
	| "de"
	| "di"
	| "do"
	| "du"
	| "ra"
	| "re"
	| "ri"
	| "ro"
	| "ru"
	| "ma"
	| "me"
	| "mi"
	| "mo"
	| "mu"
	| "fa"
	| "fe"
	| "fi"
	| "fo"
	| "fu"
	| "sa"
	| "se"
	| "si"
	| "so"
	| "su"
	| "la"
	| "le"
	| "li"
	| "lo"
	| "lu"
	| "ta"
	| "te"
	| "ti"
	| "to"
	| "tu"

Bar -> "|" {% _ => {return {type:'Bar'}} %}
	| ";" {% _ => {return {type:'GuideBar'}} %}

_ -> [ ]:+ {% data => {return null } %}

__ -> [ ]:* {% data => {return null } %}
