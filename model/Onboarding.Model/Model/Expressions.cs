namespace Onboarding.Model;

using System.Text.RegularExpressions;

/// <summary>
/// The expression language, as the skill's rules define it.
///
/// The document declares its vocabulary in §3.1 and its expressions in §14's
/// `Guard (expression)` / `Effect (expression)` columns and §15's `Formal
/// expression` column. This file PARSES and EVALUATES those expressions. It
/// knows nothing about any particular specification: the terms it resolves come
/// from the parsed vocabulary, and an expression naming a term the document does
/// not define is an UNRESOLVABLE expression - reported, never guessed.
///
/// Grammar (the skill's §3.5.1):
///
///   expr       := or
///   or         := and ( '||' and )*
///   and        := not ( '&&' not )*
///   not        := '!' not | primary
///   primary    := '(' expr ')' | comparison
///   comparison := operand ( ('=='|'!='|'<'|'<='|'>'|'>='|'=>' ) operand )?
///   operand    := term | literal | 'state' | 'input'
///   term       := ident ( '.' ident )? ( '(' args ')' )?
///
/// An expression may also be the literal text `not expressible`, meaning the
/// document says the condition cannot be written over the vocabulary. It
/// evaluates to a special "unknown" that never satisfies a guard.
/// </summary>
public static class Expressions
{
    /// <summary>The vocabulary a document declares: term name -> type.</summary>
    public sealed class Vocabulary
    {
        private readonly Dictionary<string, string> _types = new(StringComparer.OrdinalIgnoreCase);
        private readonly Dictionary<string, string[]> _domains = new(StringComparer.OrdinalIgnoreCase);
        private readonly List<string> _order = new();

        /// <summary>
        /// An identity for this vocabulary, so a cache keyed by it cannot
        /// serve one document's terms to another's expressions.
        /// </summary>
        public int Id { get; } = System.Threading.Interlocked.Increment(ref _nextId);

        private static int _nextId;

        public void Add(string term, string type, string domain = "")
        {
            var name = term.Trim();
            if (!_types.ContainsKey(name)) _order.Add(name);
            _types[name] = type.Trim();
            _domains[name] = ParseDomain(domain);
        }

        public bool Has(string term) => _types.ContainsKey(term);

        public string TypeOf(string term) =>
            _types.TryGetValue(term, out var t) ? t : "";

        /// <summary>The values the document says a term may take.</summary>
        public string[] DomainOf(string term) =>
            _domains.TryGetValue(term, out var d) ? d : Array.Empty<string>();

        /// <summary>
        /// The terms, in the order the DOCUMENT lists them.
        ///
        /// The order matters: it is the canonical order in which the model's
        /// edits are explored, and it must be the document's order, not an
        /// alphabetical one — the document groups the terms by what they are
        /// for, and that grouping is what makes the edit order meaningful.
        /// </summary>
        public IEnumerable<string> Terms => _order;

        /// <summary>Terms a set-typed term may hold, for `contains` checks.</summary>
        public bool IsSet(string term) => TypeOf(term) == "set";

        /// <summary>
        /// The values a domain cell declares.
        ///
        /// The document writes them as "a / b / c", or as "—" when the source
        /// leaves the domain open. A term with no declared domain has no
        /// declared values — the model does not invent them.
        /// </summary>
        private static string[] ParseDomain(string domain)
        {
            var text = (domain ?? "").Trim();
            if (text.Length == 0) return Array.Empty<string>();
            if (text is "—" or "-" or "–") return Array.Empty<string>();

            return text.Split('/', StringSplitOptions.RemoveEmptyEntries)
                       .Select(v => v.Trim())
                       .Where(v => v.Length > 0)
                       .ToArray();
        }
    }

    /// <summary>What an expression evaluates to.</summary>
    public enum Kind { Boolean, Text, Number, Unknown }

    public readonly record struct Value(Kind Kind, bool Bool, string Text, double Number)
    {
        public static readonly Value Unknown = new(Kind.Unknown, false, "", 0);
        public static readonly Value True = new(Kind.Boolean, true, "", 0);
        public static readonly Value False = new(Kind.Boolean, false, "", 0);
        public static Value Of(bool b) => b ? True : False;
        public static Value Of(string s) => new(Kind.Text, false, s, 0);
        public static Value Of(double n) => new(Kind.Number, false, "", n);

        public bool Truthy => Kind == Kind.Boolean && Bool;

        public override string ToString() => Kind switch
        {
            Kind.Boolean => Bool ? "true" : "false",
            Kind.Text => $"'{Text}'",
            Kind.Number => Number.ToString(),
            _ => "unknown",
        };
    }

    /// <summary>An expression that could not be resolved to the vocabulary.</summary>
    public sealed record Unresolved(string Expression, string Reason);

    // ------------------------------------------------------------- evaluation

    /// <summary>
    /// The values an expression can read: the aggregate's attributes, the
    /// machine's current state, and the value the command carried.
    /// </summary>
    public sealed class Scope
    {
        public required Aggregate Aggregate { get; init; }
        public required string Machine { get; init; }
        public string Input { get; init; } = "";
        public required Vocabulary Vocabulary { get; init; }

        /// <summary>The state id of the machine the expression belongs to.</summary>
        public string MachineState() => Aggregate.MachineState(Machine);

        /// <summary>The state id of any machine, by id — for cross-machine reads.</summary>
        public string StateOf(string machineId) => Aggregate.MachineState(machineId);
    }

    /// <summary>Evaluate an expression. Returns Unknown for an unresolvable one.</summary>
    public static Value Evaluate(string expression, Scope scope)
    {
        if (string.IsNullOrWhiteSpace(expression)) return Value.True;
        var text = expression.Trim();
        if (text.Equals("not expressible", StringComparison.OrdinalIgnoreCase))
            return Value.Unknown;
        if (text.StartsWith('`') && text.EndsWith('`') && text.Length >= 2)
            text = text[1..^1].Trim();

        var tokens = Tokenize(text, scope.Vocabulary);
        var parser = new Parser(tokens, scope);
        try
        {
            var value = parser.ParseExpression();
            parser.ExpectEnd();
            return value;
        }
        catch (ParseError e)
        {
            return Value.Unknown;
        }
    }

    /// <summary>
    /// Check that every term an expression names is in the document's
    /// vocabulary. This is the check that keeps the engine honest: an
    /// expression naming a term the document does not define is reported, not
    /// evaluated against a guess.
    ///
    /// A term may be several words ("legal business name"), so the vocabulary
    /// terms are matched first, longest first, and whatever identifiers remain
    /// afterwards are the ones the document does not define.
    /// </summary>
    public static Unresolved? Resolve(string expression, Vocabulary vocabulary)
    {
        if (string.IsNullOrWhiteSpace(expression)) return null;
        var text = expression.Trim();
        if (text.Equals("not expressible", StringComparison.OrdinalIgnoreCase)) return null;
        if (text.StartsWith('`') && text.EndsWith('`') && text.Length >= 2)
            text = text[1..^1].Trim();

        var remaining = StripLiterals(text);

        // The vocabulary's terms, longest first, so a longer term wins over a
        // shorter one that starts the same way.
        var terms = vocabulary.Terms.OrderByDescending(t => t.Length).ToList();
        foreach (var term in terms)
        {
            if (term.Length == 0) continue;
            remaining = System.Text.RegularExpressions.Regex.Replace(
                remaining, @"(?<![\w])" + System.Text.RegularExpressions.Regex.Escape(term) + @"(?![\w])",
                " ");
        }

        // The language's own words are not terms.
        foreach (var keyword in Keywords)
        {
            remaining = System.Text.RegularExpressions.Regex.Replace(
                remaining, @"(?<![\w])" + keyword + @"(?![\w])", " ");
        }

        foreach (var ident in Identifiers(remaining))
        {
            if (ident.Length == 0) continue;
            return new Unresolved(expression, $"term '{ident}' is not in the document's vocabulary");
        }
        return null;
    }

    /// <summary>
    /// Does an expression name this term?
    ///
    /// A term may be several words ("legal business name"), so it is matched
    /// as a whole phrase and not as a run of separate words.
    /// </summary>
    public static bool NamesTerm(string expression, string term)
    {
        if (string.IsNullOrWhiteSpace(expression) || string.IsNullOrWhiteSpace(term)) return false;
        var cleaned = StripLiterals(expression);
        var pattern = @"(?<![\w])" + System.Text.RegularExpressions.Regex.Escape(term) + @"(?![\w])";
        return System.Text.RegularExpressions.Regex.IsMatch(cleaned, pattern,
            System.Text.RegularExpressions.RegexOptions.IgnoreCase);
    }

    /// <summary>The words the expression language itself uses.</summary>
    private static readonly string[] Keywords =
    {
        "state", "input", "true", "false",
        "set", "clear", "add", "remove", "apply",
        "contains", "empty", "count",
        "if", "then", "not", "expressible",
    };

    /// <summary>Remove the string literals, so a quoted value is not read as a term.</summary>
    private static string StripLiterals(string text)
    {
        var cleaned = new System.Text.StringBuilder();
        var inString = false;
        foreach (var ch in text)
        {
            if (ch == '\'') { inString = !inString; cleaned.Append(' '); continue; }
            if (!inString) cleaned.Append(ch);
        }
        return cleaned.ToString();
    }

    /// <summary>
    /// The expression without the Markdown code fence around it.
    ///
    /// The document writes an expression in backticks, and the cell keeps
    /// them. A whole expression is fine with that - the evaluator unwraps
    /// it - but anything that takes the expression APART has to unwrap it
    /// first, or the fence ends up inside a fragment and the fragment does
    /// not parse.
    /// </summary>
    public static string Unwrap(string expression)
    {
        var text = (expression ?? "").Trim();
        if (text.StartsWith('`') && text.EndsWith('`') && text.Length >= 2)
            text = text[1..^1].Trim();
        return text;
    }

    /// <summary>
    /// Split an expression on its top-level "&&" conjuncts.
    ///
    /// The conjuncts are what an invariant is really made of: each one may be
    /// checkable or not, independently. A conjunct the document marks "not
    /// expressible" does not make the whole invariant unevaluable - it makes
    /// THAT conjunct unevaluable, and the rest still hold or fail on their
    /// own. Splitting them is what lets the report say "checked in part"
    /// instead of either silently dropping the invariant or asserting it.
    /// </summary>
    public static string[] SplitConjuncts(string expression)
    {
        var text = Unwrap(expression);
        if (string.IsNullOrWhiteSpace(text)) return Array.Empty<string>();

        var parts = new List<string>();
        var current = new System.Text.StringBuilder();
        var depth = 0;
        var inString = false;

        for (int i = 0; i < text.Length; i++)
        {
            var ch = text[i];
            if (ch == '\'') { inString = !inString; current.Append(ch); continue; }
            if (!inString)
            {
                if (ch == '(') depth++;
                else if (ch == ')') depth--;
                else if (depth == 0 && ch == '&' && i + 1 < text.Length && text[i + 1] == '&')
                {
                    parts.Add(current.ToString().Trim());
                    current.Clear();
                    i++;
                    continue;
                }
            }
            current.Append(ch);
        }
        parts.Add(current.ToString().Trim());
        return parts.Where(p => p.Length > 0).ToArray();
    }

    /// <summary>
    /// A type problem in an expression, if it has one.
    ///
    /// The vocabulary declares each term's type, and the expression language
    /// defines what each accessor means on each type: `count` and `contains`
    /// are set operations. An expression that calls them on a text term is
    /// not evaluable as written - it is a defect in the document, and the
    /// report says so rather than inventing a reading of it.
    /// </summary>
    public static string? TypeProblem(string expression, Vocabulary vocabulary)
    {
        if (string.IsNullOrWhiteSpace(expression)) return null;

        foreach (Match m in Regex.Matches(expression, @"([A-Za-z][A-Za-z0-9 ]*?)\s*\.\s*(count|contains)\b"))
        {
            var name = m.Groups[1].Value.Trim();
            if (name.Length == 0) continue;
            if (!vocabulary.Has(name)) continue;      // reported as unresolved
            var type = vocabulary.TypeOf(name);
            if (type != "set")
                return $"'{name}' is a {type} term; '.{m.Groups[2].Value}' is defined only for a set term";
        }
        return null;
    }

    /// <summary>
    /// Every identifier appearing in an expression, as words.
    ///
    /// A number is a literal, not a term, so a numeric token is not an
    /// identifier.
    /// </summary>
    public static IEnumerable<string> Identifiers(string expression)
    {
        var cleaned = StripLiterals(expression);
        var word = new System.Text.StringBuilder();
        foreach (var ch in cleaned)
        {
            if (char.IsLetter(ch) || ch == '_')
                word.Append(ch);
            else if (char.IsDigit(ch))
            {
                // A number is a literal. Emit the word so far, drop the digits.
                if (word.Length > 0) { yield return word.ToString(); word.Clear(); }
                continue;
            }
            else
            {
                if (word.Length > 0) { yield return word.ToString(); word.Clear(); }
            }
        }
        if (word.Length > 0) yield return word.ToString();
    }

    // --------------------------------------------------------------- tokenizer

    private enum T { Ident, String, Number, Op, LParen, RParen, End }

    private readonly record struct Token(T Type, string Text, double Number);

    private sealed class ParseError : Exception
    {
        public ParseError(string message) : base(message) { }
    }

    /// <summary>
    /// The tokens of an expression, cached.
    ///
    /// An expression is tokenised the same way every time it is evaluated,
    /// and it is evaluated once per state per invariant — so without this
    /// cache the traversal re-tokenises the document's whole vocabulary for
    /// every state it reaches. The cache is keyed by the expression text
    /// and the vocabulary it was tokenised against.
    /// </summary>
    private static readonly Dictionary<(string Text, int VocabularyId), List<Token>> _tokenCache = new();

    private static List<Token> Tokenize(string text, Vocabulary vocabulary)
    {
        var key = (text, vocabulary.Id);
        if (_tokenCache.TryGetValue(key, out var cached)) return cached;

        var tokens = TokenizeUncached(text, vocabulary);
        _tokenCache[key] = tokens;
        return tokens;
    }

    private static List<Token> TokenizeUncached(string text, Vocabulary vocabulary)
    {
        var tokens = new List<Token>();
        // The vocabulary's terms, longest first: a term may be several words
        // ("legal business name"), so it is matched as a whole rather than
        // split into identifiers the document never defined.
        var terms = vocabulary.Terms.OrderByDescending(t => t.Length).ToList();
        var i = 0;
        while (i < text.Length)
        {
            var ch = text[i];
            if (char.IsWhiteSpace(ch)) { i++; continue; }
            if (ch == '\'')                                     // string literal
            {
                i++;
                var sb = new System.Text.StringBuilder();
                while (i < text.Length && text[i] != '\'') sb.Append(text[i++]);
                if (i >= text.Length) throw new ParseError("unterminated string");
                i++;                                            // closing quote
                tokens.Add(new Token(T.String, sb.ToString(), 0));
                continue;
            }
            if (char.IsDigit(ch))
            {
                var start = i;
                while (i < text.Length && (char.IsDigit(text[i]) || text[i] == '.')) i++;
                tokens.Add(new Token(T.Number, text[start..i], double.Parse(text[start..i])));
                continue;
            }
            if (char.IsLetter(ch) || ch == '_')
            {
                // A vocabulary term, if one starts here.
                var matched = "";
                foreach (var term in terms)
                {
                    if (term.Length == 0) continue;
                    if (i + term.Length > text.Length) continue;
                    if (!string.Compare(text, i, term, 0, term.Length,
                                        StringComparison.OrdinalIgnoreCase).Equals(0)) continue;
                    // The term must not be cut short by a longer word.
                    var after = i + term.Length;
                    if (after < text.Length && (char.IsLetterOrDigit(text[after]) || text[after] == '_')) continue;
                    matched = term;
                    break;
                }

                if (matched.Length > 0)
                {
                    tokens.Add(new Token(T.Ident, matched, 0));
                    i += matched.Length;
                    continue;
                }

                var start = i;
                while (i < text.Length && (char.IsLetterOrDigit(text[i]) || text[i] == '_')) i++;
                tokens.Add(new Token(T.Ident, text[start..i], 0));
                continue;
            }
            if (ch == '(') { tokens.Add(new Token(T.LParen, "(", 0)); i++; continue; }
            if (ch == ')') { tokens.Add(new Token(T.RParen, ")", 0)); i++; continue; }

            var two = i + 1 < text.Length ? text.Substring(i, 2) : "";
            if (two is "&&" or "||" or "==" or "!=" or "<=" or ">=" or "=>")
            {
                tokens.Add(new Token(T.Op, two, 0));
                i += 2;
                continue;
            }
            if (ch is '<' or '>' or '!' or '.')
            {
                tokens.Add(new Token(T.Op, ch.ToString(), 0));
                i++;
                continue;
            }
            throw new ParseError($"unexpected character '{ch}'");
        }
        tokens.Add(new Token(T.End, "", 0));
        return tokens;
    }

    // ----------------------------------------------------------------- parser

    private sealed class Parser
    {
        private readonly List<Token> _tokens;
        private readonly Scope _scope;
        private int _position;

        public Parser(List<Token> tokens, Scope scope)
        {
            _tokens = tokens;
            _scope = scope;
        }

        private Token Current => _tokens[_position];

        public void ExpectEnd()
        {
            if (Current.Type != T.End) throw new ParseError($"unexpected '{Current.Text}'");
        }

        public Value ParseExpression() => ParseOr();

        private Value ParseOr()
        {
            var left = ParseAnd();
            while (Current.Type == T.Op && Current.Text == "||")
            {
                _position++;
                var right = ParseAnd();
                // Three-valued: unknown OR true is true; unknown OR false is unknown.
                left = left.Kind == Kind.Unknown ? right
                     : right.Kind == Kind.Unknown ? left
                     : Value.Of(left.Bool || right.Bool);
            }
            return left;
        }

        private Value ParseAnd()
        {
            var left = ParseNot();
            while (Current.Type == T.Op && Current.Text == "&&")
            {
                _position++;
                var right = ParseNot();
                left = left.Kind == Kind.Unknown ? right
                     : right.Kind == Kind.Unknown ? left
                     : Value.Of(left.Bool && right.Bool);
            }
            return left;
        }

        private Value ParseNot()
        {
            if (Current.Type == T.Op && Current.Text == "!")
            {
                _position++;
                var inner = ParseNot();
                if (inner.Kind == Kind.Unknown) return Value.Unknown;
                return Value.Of(!inner.Bool);
            }
            return ParsePrimary();
        }

        private Value ParsePrimary()
        {
            if (Current.Type == T.LParen)
            {
                _position++;
                var inner = ParseExpression();
                if (Current.Type != T.RParen) throw new ParseError("expected ')'");
                _position++;
                return inner;
            }
            return ParseComparison();
        }

        private Value ParseComparison()
        {
            var left = ParseOperand();

            if (Current.Type == T.Op && Current.Text == "=>")
            {
                _position++;
                var right = ParseComparison();
                if (left.Kind == Kind.Unknown || right.Kind == Kind.Unknown) return Value.Unknown;
                return Value.Of(!left.Bool || right.Bool);
            }

            if (Current.Type == T.Op && Current.Text is "==" or "!=" or "<" or "<=" or ">" or ">=")
            {
                var op = Current.Text;
                _position++;
                var right = ParseOperand();
                if (left.Kind == Kind.Unknown || right.Kind == Kind.Unknown) return Value.Unknown;

                if (op == "==") return Value.Of(Same(left, right));
                if (op == "!=") return Value.Of(!Same(left, right));

                // Ordering only between numbers, or between texts.
                if (left.Kind == Kind.Number && right.Kind == Kind.Number)
                {
                    return op switch
                    {
                        "<" => Value.Of(left.Number < right.Number),
                        "<=" => Value.Of(left.Number <= right.Number),
                        ">" => Value.Of(left.Number > right.Number),
                        _ => Value.Of(left.Number >= right.Number),
                    };
                }
                var cmp = string.CompareOrdinal(left.Text, right.Text);
                return op switch
                {
                    "<" => Value.Of(cmp < 0),
                    "<=" => Value.Of(cmp <= 0),
                    ">" => Value.Of(cmp > 0),
                    _ => Value.Of(cmp >= 0),
                };
            }

            return left;
        }

        private static bool Same(Value left, Value right)
        {
            if (left.Kind == Kind.Number && right.Kind == Kind.Number) return left.Number == right.Number;
            if (left.Kind == Kind.Boolean && right.Kind == Kind.Boolean) return left.Bool == right.Bool;
            return left.Text == right.Text;
        }

        private Value ParseOperand()
        {
            switch (Current.Type)
            {
                case T.String:
                    {
                        var value = Value.Of(Current.Text);
                        _position++;
                        return value;
                    }
                case T.Number:
                    {
                        var value = Value.Of(Current.Number);
                        _position++;
                        return value;
                    }
                case T.Ident:
                    {
                        var name = Current.Text;
                        _position++;
                        if (name == "true") return Value.True;
                        if (name == "false") return Value.False;
                        if (name == "state") return Value.Of(_scope.MachineState());
                        if (name == "input") return Value.Of(_scope.Input);
                        return ReadTerm(name);
                    }
                default:
                    throw new ParseError($"unexpected '{Current.Text}'");
            }
        }

        /// <summary>Read a term, with its accessor.</summary>
        private Value ReadTerm(string name)
        {
            string accessor = "";
            if (Current.Type == T.Op && Current.Text == ".")
            {
                _position++;
                if (Current.Type != T.Ident) throw new ParseError("expected an accessor name");
                accessor = Current.Text;
                _position++;
            }

            // A call: term.contains('x'), term.empty(), term.count
            string[] args = [];
            if (Current.Type == T.LParen)
            {
                _position++;
                var list = new List<string>();
                while (Current.Type != T.RParen && Current.Type != T.End)
                {
                    if (Current.Type == T.String) list.Add(Current.Text);
                    _position++;
                    if (Current.Type == T.Op && Current.Text == ",") _position++;
                }
                if (Current.Type != T.RParen) throw new ParseError("expected ')'");
                _position++;
                args = list.ToArray();
            }

            if (!_scope.Vocabulary.Has(name)) return Value.Unknown;

            if (accessor == "count")
            {
                // `term.count` is defined for a SET term (§3.5.1). On a text
                // or flag term it has no meaning, so it does not evaluate -
                // it is not a zero. The document's own vocabulary decides;
                // `check` reports the mismatch as a defect in the document.
                if (_scope.Vocabulary.TypeOf(name) != "set") return Value.Unknown;
                var set = _scope.Aggregate.GetSet(name);
                return Value.Of((double)set.Count);
            }

            if (accessor == "contains")
            {
                if (_scope.Vocabulary.TypeOf(name) != "set") return Value.Unknown;
                var set = _scope.Aggregate.GetSet(name);
                return Value.Of(args.Length > 0 && set.Contains(args[0]));
            }

            if (accessor == "empty")
            {
                var type = _scope.Vocabulary.TypeOf(name);
                if (type == "set") return Value.Of(_scope.Aggregate.GetSet(name).Count == 0);
                if (type == "flag") return Value.Of(_scope.Aggregate.Get(name) is not true);
                return Value.Of(string.IsNullOrEmpty(_scope.Aggregate.GetString(name) ?? ""));
            }

            // A bare term: a flag is its truth value, a text is its string.
            var termType = _scope.Vocabulary.TypeOf(name);
            if (termType == "flag")
                return Value.Of(_scope.Aggregate.Get(name) is true);
            if (termType == "set")
                return Value.Of(string.Join(",", _scope.Aggregate.GetSet(name).OrderBy(x => x)));
            return Value.Of(_scope.Aggregate.GetString(name) ?? "");
        }
    }
}
