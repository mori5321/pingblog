{
  description = "Node.js 24 development environment";

  inputs = {
    # Stable チャンネル (例: 24.11)。必要に応じてバージョンを変更してください。
    nixpkgs.url = "github:nixos/nixpkgs/nixos-24.11";

    # Unstable チャンネル (Node.js 24 や最新の pnpm 用)
    nixpkgs-unstable.url = "github:nixos/nixpkgs/nixos-unstable";
  };

  outputs = { self, nixpkgs, nixpkgs-unstable }:
    let
      # サポートするシステムアーキテクチャ
      supportedSystems = [ "x86_64-linux" "aarch64-linux" "x86_64-darwin" "aarch64-darwin" ];
      
      # 全システム向けに設定を生成するヘルパー関数
      forAllSystems = f: nixpkgs.lib.genAttrs supportedSystems (system: f system);
    in
    {
      devShells = forAllSystems (system:
        let
          # Stable 版の pkgs
          pkgs = import nixpkgs { inherit system; };
          
          # Unstable 版の pkgs
          unstable = import nixpkgs-unstable { inherit system; };
        in
        {
          default = pkgs.mkShellNoCC {
            buildInputs = [
              # Unstable から取得するもの
              unstable.nodejs_24
              unstable.pnpm

              # Stable (pkgs) から取得するもの
              pkgs.typescript
              pkgs.typescript-language-server
            ];

            shellHook = ''
              echo "Node.js version: $(node --version)"
              echo "PNPM version: $(pnpm --version)"
              echo "TypeScript version: $(tsc --version)"
            '';
          };
        });
    };
}
