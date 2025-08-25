import { Drawer } from "@/components/drawer"
import { Stack } from "@/components/stack"

export default function DrawerSandbox() {
  return (
    <div class="p-8">
      <Stack>
        <Drawer
          title="Participant Details"
          contentClass="p-4 w-[25rem]">
          <>
            <p>
              Veniam ea elit tempor minim ea culpa sint est enim magna id. Amet
              adipisicing occaecat nulla velit cillum. Ex consectetur ex
              reprehenderit mollit ex id dolor ex. Quis quis enim eiusmod
              officia enim non quis qui.
            </p>
            <p>
              Minim veniam ad sint id culpa incididunt laborum nulla aliqua
              incididunt veniam amet aliqua. Et duis eiusmod cillum eiusmod
              nostrud veniam nostrud aliquip nulla sint incididunt. Enim culpa
              est duis nulla anim non id irure nulla consequat est do. Voluptate
              adipisicing do in aute ipsum veniam culpa do.
            </p>
            <p>
              Enim exercitation eiusmod consequat esse pariatur velit consequat
              veniam. Occaecat nostrud ea elit et. Dolor veniam dolor et quis
              deserunt est fugiat veniam in eiusmod cillum cupidatat.
            </p>
            <p>
              Officia sint exercitation velit do occaecat et cupidatat non dolor
              est minim. Non ut in eiusmod sunt enim aliqua amet tempor labore
              in magna. Cupidatat consequat duis nisi voluptate aliquip sint est
              ea non tempor ullamco anim.
            </p>
            <p>
              Ullamco ipsum veniam aliquip mollit incididunt. Qui nulla
              exercitation ipsum magna excepteur quis pariatur sit. Sunt anim
              reprehenderit laboris dolore ipsum in magna qui laboris. Deserunt
              sint elit sint pariatur magna. Mollit incididunt magna fugiat
              officia pariatur amet sunt voluptate dolore amet ex. Aliquip
              reprehenderit voluptate laboris non excepteur.
            </p>
            <p>
              Minim cillum do culpa ipsum occaecat minim quis laboris non
              exercitation ullamco. Mollit qui veniam esse laborum occaecat.
              Culpa non et occaecat labore incididunt velit veniam Lorem ut
              Lorem id deserunt anim eiusmod.
            </p>
            <p>
              Incididunt sit ad esse eu ad adipisicing nulla velit in aute
              occaecat tempor. Laboris aliqua ullamco aliqua voluptate ad
              cupidatat veniam ullamco ipsum laborum aute ipsum. Aute
              reprehenderit eiusmod elit ut magna cupidatat aute excepteur ut
              anim proident.
            </p>
            <p>
              Adipisicing ea qui dolor quis anim ad est incididunt. Enim
              voluptate pariatur nulla duis Lorem non ipsum commodo. Duis eu
              nostrud nulla aliquip officia sunt aliqua occaecat incididunt
              sunt. Cillum elit veniam aliqua dolore sunt ea veniam sint
              consequat. Esse cupidatat culpa duis eu adipisicing enim elit
              labore occaecat tempor ad deserunt nisi. Id fugiat cupidatat
              commodo culpa aliquip.
            </p>
            <p>
              Laboris tempor est qui sint sit consequat nostrud laborum ea aute.
              Tempor nisi commodo id velit laboris do veniam sit et anim qui
              minim. Sunt aliqua in Lorem sit laboris occaecat non sint proident
              aute do minim incididunt voluptate. Ipsum dolore tempor voluptate
              laboris excepteur consectetur cillum anim ea aute. Eiusmod culpa
              nostrud in commodo ullamco minim duis et laborum enim sint non.
            </p>
          </>
        </Drawer>
        <Drawer
          position="left"
          title="Left"
          subtitle="This drawer is on the left">
          This is the way the world ends. Not with a bang but with a whimper.
        </Drawer>
        <Drawer
          position="top"
          title="Top Drawer"
          contentClass="p-4">
          This is the way the world ends. Not with a bang but with a whimper.
        </Drawer>
        <Drawer
          position="bottom"
          contentClass="p-4 h-[15rem]">
          This is the way the world ends. Not with a bang but with a whimper.
        </Drawer>
        <Drawer
          position="bottom"
          showCloseButton={false}
          class="w-[100vw] p-4 md:max-w-[30rem] left-1/2 -translate-x-1/2 border border-[var(--colors-info)] rounded-tl-xl rounded-tr-xl"
          contentClass="">
          Address and Phone Number
        </Drawer>
      </Stack>
    </div>
  )
}
