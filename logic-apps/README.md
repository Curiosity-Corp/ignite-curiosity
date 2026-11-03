# Logic Apps

`focuspass-registration.definition.json` is a snapshot of the FocusPass registration workflow.
Its SMS send is still the Twilio connector action `Send_Text_Message_(SMS)`; production sends
through SignalWire from FocusApiary/infrastructure (`logicapps/estate`), where Twilio was retired.

## SMS brand signature (CEO mandate 2026-11-03)

No SMS/MMS leaves our systems without the brand name "Focus Hive". The send's message text is
wrapped in a guard, a Logic Apps expression that returns the text unchanged when the brand is
present and otherwise appends `\n- Focus Hive`. The rule, its 20 test vectors and the STOP/HELP
policy are in FocusApiary/infrastructure `docs/sms-policy.md`; the brand is the single setting
`SMS_BRAND_NAME` (default "Focus Hive") read when the definition is generated.

`sms-guard/` is a vendored copy of the generator, the reference module, the vectors and the
expression evaluator. Do not edit the guard by hand:

    python3 logic-apps/sms-guard/signalwire_sms.py guard-file logic-apps/focuspass-registration.definition.json
    python3 logic-apps/sms-guard/signalwire_sms.py check logic-apps/focuspass-registration.definition.json
    (cd logic-apps/sms-guard/tests && python3 -m unittest -v)

`.gitlab-ci.yml` runs the check and the tests on every merge request. The canonical rule lives in
FocusApiary/infrastructure; change it there and re-copy the four files.
