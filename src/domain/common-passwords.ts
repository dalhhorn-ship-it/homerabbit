// Frequently used passwords of 10+ characters (shorter ones are refused by the length rule anyway). Lower case.
// A short bundled list, not a breach corpus: it catches the obvious choices only (ADR 0013).
export const COMMON_PASSWORDS: ReadonlySet<string> = new Set(
  `password1 password12 password123 password1234 password12345 passw0rd123 password!23 password2020 password2021
  password2022 password2023 password2024 password2025 password2026 1234567890 12345678910 0123456789 0987654321
  1234567891 123456789a 1q2w3e4r5t 1qaz2wsx3e 1qaz2wsxedc qwertyuiop qwertyuiop1 qwerty1234 qwerty12345 qwerty123456
  qwertyuiop123 asdfghjkl1 asdfghjkl12 asdfghjkl123 asdfghjklq zxcvbnm123 zxcvbnm1234 qazwsxedc1 qazwsxedcrfv
  iloveyou12 iloveyou123 iloveyou1234 iloveyou2 iloveyou! ilovemyself ilovemyfamily ilovemyhome ilovehome1
  letmein123 letmein1234 letmeinplease welcome123 welcome1234 welcome12345 welcome2home admin12345 admin123456
  administrator administrator1 administrador changeme123 changemenow trustno1234 mypassword1 mypassword12 mypassword123
  mypassword! myhousehold home123456 homesweethome house123456 household1 familyfamily family1234 family12345
  monkey1234 monkey12345 dragon1234 dragon12345 football123 football1234 baseball123 basketball1 soccer1234
  superman123 batman12345 spiderman1 starwars123 pokemon123 princess123 princess1234 sunshine123 sunshine1234
  chocolate1 chocolate12 butterfly1 butterfly12 charlie1234 michael1234 jennifer123 jessica1234 daniel12345
  matthew1234 anthony1234 abcdefghij abcdefghi1 abcdefg123 abcd123456 abcd1234567 abc1234567 abc123456789
  aaaaaaaaaa 1111111111 0000000000 2222222222 1212121212 1231231234 1122334455 11223344556 123123123123 123456123456
  147258369 1472583690 9876543210 987654321a 111222333444 123qweasdzxc 123qwe123qwe q1w2e3r4t5 q1w2e3r4t5y6 qweasdzxc123
  qweqweqwe123 passwordpassword password0000 passwordpass football12 trustnoone1 whateverwhatever freedom1234
  mustang1234 shadow12345 master12345 hello12345 hello123456 helloworld1 helloworld123 testtest123 test123456 test1234567
  loveyou1234 forever1234 secret12345 secretsecret internet123 computer123 computer1234 samsung123 google12345 gmail12345
  baseballbat summer2023 summer2024 summer2025 summer2026 winter2024 winter2025 winter2026 spring2025 spring2026
  autumn2025 autumn2026 january2026 february2026 march20266 newyork1234 london12345 california1 1password11 passw0rd1234
  p@ssw0rd123 p@ssword123 p@ssw0rd!23 pa55word123 pa$$word123 pa$$w0rd123 qwerty!23456 qwerty@12345 abc@123456 admin@12345
  default1234 guest123456 user123456 rabbit12345 homerabbit homerabbit1 homerabbit12 homerabbit123`
    .split(/\s+/)
    .filter(Boolean),
);
