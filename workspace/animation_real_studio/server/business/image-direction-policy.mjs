const cleanText = (value) => typeof value === "string" ? value.trim() : "";

const REAL_PERSON_KEYWORDS = /\b(celebrity|real person|public figure|famous person|taylor swift|emma watson|beyonc[eé]|kim kardashian|scarlett johansson|brad pitt|tom cruise)\b|실존\s*(?:인물|사람)|유명인|연예인|아이유/i;
const ENGLISH_PROPER_NAME_CONTEXT = /\b(?:portrait\s+of|resembling|looks?\s+like|depicting)\s+[A-Z][a-z]{1,24}(?:\s+[A-Z][a-z]{1,24})?\b|\b[A-Z][a-z]{1,24}\s+[A-Z][a-z]{1,24}\s+(?:poses|wears|models|appears|performs|receives)\b/;
const KNOWN_SINGLE_NAME = /\b(zendaya|madonna)\b/i;
const MINOR_AGE_VARIANTS = /\b(?:age|aged)\s*:?\s*(?:[0-9]|1[0-9]|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\b|\b(?:adult|person|woman|man|girl|boy|subject|character)\s+(?:[0-9]|1[0-9]|zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)\s+(?:years?|yrs?)(?:\s+old)?\b|\b(?:[0-9]|1[0-9])\s*y\.?\/?o\.?\b|\b(?:under|younger\s+than)\s+(?:20|twenty)\b/i;
const EXPLICIT_VARIANTS = /\b(sexually\s+explicit|explicitly\s+sexual|adult\s+(?:film|movie|video))\b/i;
const COERCIVE_VARIANTS = /\b(with(?:out\s+(?:(?:his|her|their)\s+)?(?:consent|permission)|\s+no\s+consent)|against\s+(?:(?:his|her|their)\s+)?(?:will|wishes|consent)|(?:forced|made\s+to).{0,40}(?:pose|posing|wear|wearing|sensual|seductive|erotic|sexual|lingerie))\b/i;
const FICTIONAL_ATTESTATION_CONFLICT = /\b(non[- ]?fictional|not\s+(?:(?:a|an)\s+)?(?:fictional|imaginary|invented)|actually\s+(?:a\s+)?real\s+(?:adult|person|woman|man)|real\s+(?:adult|friend|person|woman|man)|my\s+(?:real\s+)?(?:friend|partner|spouse|coworker|colleague)|based\s+on\s+(?:my|a|an|the)\s+(?:real\s+)?(?:friend|partner|spouse|coworker|colleague|person|adult|woman|man))\b|비가상|가상이\s*아닌|실제\s*(?:성인|인물|사람|여성|남성|친구)|(?:내|나의)\s*(?:실제\s*)?(?:친구|지인|동료)(?:를|을)?\s*(?:기반|바탕)/i;
const ADULT_NON_GRAPHIC_ADVERBS = /\b(sensually|provocatively|sexily)\b/i;
const MINOR_OR_AMBIGUOUS = /\b(minor|child|children|underage|under\s+(?:the\s+age\s+of\s+)?(?:18|eighteen)|teen(?:ager|age|aged)?|baby|babies|newborn|toddler|infant|preteen|adolescent|juvenile|youth|kid|grade[- ]schooler|elementary\s+schooler|middle\s+schooler|high\s+schooler|schoolgirl|schoolboy|high\s+school\s+senior|girl|boy|barely legal|young-looking|age[- ]?(?:ambiguous|unclear)|school[- ]age)\b|\bage\s*(?:[0-9]|1[0-9])\b|\b(?:[0-9]|1[0-9])\s*[- ]?\s*(?:years?|yrs?)\s*[- ]?\s*old\b|\b(?:[0-9]|1[0-9])\s*y\/?o\b|(?:^|\D)(?:[0-9]|1[0-9])\s*\+(?!\d)|\b(?:zero|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen)(?:[- ]years?[- ]old|\s+(?:years?|yrs?)\s+old)\b|미성년자?|아동|어린이|어린\s*학생|청소년|10대|십대|아기|신생아|유아|영아|사춘기|여고생|남고생|초등생|초등학생|중학생|고등학생|소녀|소년|어려\s*보이는|앳된|연령\s*(?:모호|불명)|나이\s*(?:모호|불명)|(?<!\d)(?:[0-9]|1[0-9])\s*(?:살|세)/i;
const EXPLICIT_OR_PORNOGRAPHIC = /\b(nude|nudity|naked|genitals?|(?:graphic|explicit)\s+(?:sex|sexual)|having\s+sex|sex\s+(?:act|acts|scene)|fuck(?:ing|ed|s)?|intercourse|oral\s+sex|anal\s+sex|fellatio|blow\s*job|hand\s*job|cunnilingus|rim\s*job|masturbat(?:e|ion|ing)|penetrat(?:e|ion|ing)|orgasm|ejaculat(?:e|ion|ing)|porn(?:ographic|ography)?|hardcore|xxx)\b|누드|나체|알몸|성기|노골적\s*성|성행위|성교|성관계|섹스(?:하는|\s*장면)?|구강성교|오럴\s*섹스|항문성교|펠라치오|블로잡|자위|삽입|오르가즘|사정|포르노|음란물/i;
const COERCIVE_OR_EXPLOITATIVE = /\b(rape|raping|non[- ]?consensual|without\s+consent|against\s+(?:his|her|their)\s+will|coerced?|unwilling|under\s+duress|incapacitated|forced.{0,40}(?:pose|posing|sensual|seductive|erotic|sexual)|sexual\s+coercion|drugged\s+sex(?:ual)?|unconscious\s+sex(?:ual)?)\b|강간|비동의|동의\s*없이|강제(?:적)?\s*성|(?:강제로|억지로).{0,30}(?:관능|에로틱|성적|유혹|포즈)|성적\s*강요|의식\s*없는\s*성/i;
const ADULT_NON_GRAPHIC = /\b(sensual|erotic(?:a|ally)?|seductiv(?:e|ely)|provocative|sexy|sexual\s+expression|lingerie|boudoir|fetish)\b|관능적|에로틱|유혹적|도발적|섹시|성적\s*표현|란제리|부두아르|페티시|야한/i;
const FICTIONAL_ATTESTATION = /\b(fictional|non[- ]identifying|imaginary|invented|original character)\b|가상|비식별|창작(?:한|된)?\s*인물/i;
const AGE_CODED_STYLE = /\b(school\s*uniform|school[- ]inspired|student\s*uniform)\b|교복|학교풍/i;

export function classifyImageDirection(value, { schoolInspired = false } = {}) {
  const direction = cleanText(value);
  const adultNonGraphic = ADULT_NON_GRAPHIC.test(direction) || ADULT_NON_GRAPHIC_ADVERBS.test(direction);
  const fictionalConflict = FICTIONAL_ATTESTATION_CONFLICT.test(direction);
  const fictionalAttested = FICTIONAL_ATTESTATION.test(direction) && !fictionalConflict;
  const blockingCodes = [];
  if (REAL_PERSON_KEYWORDS.test(direction) || ENGLISH_PROPER_NAME_CONTEXT.test(direction) || KNOWN_SINGLE_NAME.test(direction)) blockingCodes.push("real_person_blocked");
  if (fictionalConflict) blockingCodes.push("real_person_blocked");
  if (MINOR_OR_AMBIGUOUS.test(direction) || MINOR_AGE_VARIANTS.test(direction)) blockingCodes.push("minor_or_ambiguous_blocked");
  if (EXPLICIT_OR_PORNOGRAPHIC.test(direction) || EXPLICIT_VARIANTS.test(direction)) blockingCodes.push("explicit_sex_blocked");
  if (COERCIVE_OR_EXPLOITATIVE.test(direction) || COERCIVE_VARIANTS.test(direction)) blockingCodes.push("explicit_sex_blocked");
  if (adultNonGraphic && !fictionalAttested) blockingCodes.push("real_person_blocked");
  if (adultNonGraphic && (schoolInspired || AGE_CODED_STYLE.test(direction))) blockingCodes.push("age_coded_sexualization_blocked");
  return {
    intent: adultNonGraphic && blockingCodes.length === 0 ? "adult_non_graphic_allowed" : blockingCodes[0] ?? "standard_allowed",
    adultNonGraphic,
    fictionalAttested,
    blockingCodes: [...new Set(blockingCodes)],
  };
}
